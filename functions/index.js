/**
 * Cloud Function proxy cho Google Cloud Speech-to-Text.
 *
 * Vì sao phải proxy thay vì gọi thẳng từ browser: gọi thẳng buộc phải nhúng API key
 * vào bundle JS, ai mở DevTools cũng lấy được và tiêu tiền trên project. Hạn chế theo
 * HTTP referrer thì giả mạo được bằng curl. Function giữ credential ở phía server và
 * tiện thể ghi luôn shadowing_attempts bằng Admin SDK (client không được ghi trực tiếp,
 * nếu không thì score/confidence do client tự khai, dữ liệu mất hết ý nghĩa).
 *
 * YÊU CẦU:
 *   - Firebase project ở gói Blaze (Spark không cho function gọi mạng ra ngoài)
 *   - Bật Cloud Speech-to-Text API trong Google Cloud Console
 *   - Đặt OWNER_UID bên dưới bằng uid thật của bạn
 *
 * Deploy:  firebase deploy --only functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { SpeechClient } = require("@google-cloud/speech");

admin.initializeApp();

// Chặn runaway cost: không bao giờ cần quá vài instance cho trang cá nhân
setGlobalOptions({ region: "asia-southeast1", maxInstances: 3 });

const speech = new SpeechClient();
const db = admin.firestore();

/** ⚠️ THAY bằng uid thật — lấy ở Firebase Console → Authentication → Users */
const OWNER_UID = process.env.SHADOWING_OWNER_UID || "REPLACE_WITH_YOUR_UID";

/** speech:recognize đồng bộ giới hạn 60 giây audio và 10MB inline */
const MAX_AUDIO_SECONDS = 60;
const MAX_BASE64_BYTES = 9 * 1024 * 1024;

/* ------------------------------------------------------------------ *
 * So khớp transcript với câu gốc.
 * Giữ bản sao logic của src/lib/diff.js — function chạy ở Node, không
 * import được module của CRA. Sửa một bên thì nhớ sửa bên kia.
 * ------------------------------------------------------------------ */

function normalizeJa(input) {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[、。！？「」『』・,.!?;:]/g, "");
}

function diffJa(ref, hyp) {
  const a = Array.from(ref);
  const b = Array.from(hyp);
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return { distance: 0, accuracy: 1, ops: [] };

  const d = [];
  for (let i = 0; i <= m; i++) {
    d.push(new Uint32Array(n + 1));
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] =
        a[i - 1] === b[j - 1]
          ? d[i - 1][j - 1]
          : 1 + Math.min(d[i - 1][j - 1], d[i - 1][j], d[i][j - 1]);
    }
  }

  const raw = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ op: "equal", ch: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      raw.push({ op: "replace", ch: b[j - 1], expected: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      raw.push({ op: "insert", ch: b[j - 1] });
      j--;
    } else {
      raw.push({ op: "delete", ch: a[i - 1] });
      i--;
    }
  }
  raw.reverse();

  const ops = [];
  for (const item of raw) {
    const last = ops[ops.length - 1];
    if (last && last.op === item.op) {
      last.text += item.ch;
      if (item.expected) last.expected = (last.expected || "") + item.expected;
    } else {
      const next = { op: item.op, text: item.ch };
      if (item.expected) next.expected = item.expected;
      ops.push(next);
    }
  }

  const distance = d[m][n];
  return { distance, accuracy: Math.max(0, 1 - distance / Math.max(m, 1)), ops };
}

function scoreTranscript(refRaw, hypRaw) {
  const refNormalized = normalizeJa(refRaw);
  const hypNormalized = normalizeJa(hypRaw);
  const { distance, accuracy, ops } = diffJa(refNormalized, hypNormalized);
  return { refNormalized, hypNormalized, distance, accuracy, diff: ops };
}

/* ------------------------------------------------------------------ */

exports.transcribeShadowing = onCall(
  { memory: "512MiB", timeoutSeconds: 60 },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid || uid !== OWNER_UID) {
      throw new HttpsError("permission-denied", "Tài khoản này không được phép dùng.");
    }

    const {
      audioBase64,
      sampleRate = 16000,
      videoId = "",
      lineId = null,
      refText = "",
      videoTimeAtStart = null,
    } = request.data || {};

    if (!audioBase64 || typeof audioBase64 !== "string") {
      throw new HttpsError("invalid-argument", "Thiếu dữ liệu audio.");
    }
    if (audioBase64.length > MAX_BASE64_BYTES) {
      throw new HttpsError("invalid-argument", "Bản ghi quá dài. Thu lại ngắn hơn.");
    }

    // 2 byte/mẫu cho LINEAR16; base64 phình ~4/3
    const approxSeconds = (audioBase64.length * 0.75) / (sampleRate * 2);
    if (approxSeconds > MAX_AUDIO_SECONDS) {
      throw new HttpsError("invalid-argument", "Bản ghi vượt quá 60 giây.");
    }

    const startedAt = Date.now();
    let response;
    try {
      [response] = await speech.recognize({
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: sampleRate,
          audioChannelCount: 1,
          languageCode: "ja-JP",
          model: "latest_short", // tối ưu cho câu ngắn
          enableAutomaticPunctuation: false, // dấu câu tự thêm làm lệch so khớp
          maxAlternatives: 1,
          profanityFilter: false,
        },
        audio: { content: audioBase64 },
      });
    } catch (err) {
      console.error("[transcribeShadowing] STT lỗi:", err);
      throw new HttpsError("internal", "Dịch vụ nhận dạng gặp lỗi. Thử lại sau.");
    }

    const latencyMs = Date.now() - startedAt;
    const alternative =
      response.results && response.results[0] && response.results[0].alternatives
        ? response.results[0].alternatives[0]
        : null;

    const transcript = alternative && alternative.transcript ? alternative.transcript.trim() : "";
    const confidence = alternative && alternative.confidence ? alternative.confidence : 0;

    if (!transcript) {
      return { transcript: "", confidence: 0, score: null, latencyMs };
    }

    const score = scoreTranscript(refText, transcript);

    // Ghi lịch sử. Lỗi ghi KHÔNG được làm hỏng kết quả trả về cho người dùng.
    try {
      await db.collection("shadowing_attempts").add({
        schemaVersion: 1,
        ownerUid: uid,
        videoId,
        lineId,
        audio: {
          storagePath: null, // phase 3: upload WAV lên Storage rồi điền vào đây
          mimeType: "audio/wav",
          encoding: "LINEAR16",
          sampleRateHertz: sampleRate,
          channels: 1,
          durationMs: Math.round(approxSeconds * 1000),
          bytes: Math.round(audioBase64.length * 0.75),
        },
        stt: {
          provider: "google-stt-v1",
          model: "latest_short",
          languageCode: "ja-JP",
          transcript,
          confidence,
          latencyMs,
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        score,
        videoTimeAtStart,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[transcribeShadowing] Không ghi được attempt:", err);
    }

    return { transcript, confidence, score, latencyMs };
  }
);

/* Tự điền kana/romaji/nghĩa/furigana cho chế độ soạn bài — xem enrich.js */
exports.enrichShadowingLines = require("./enrich").enrichShadowingLines;
