/**
 * Cloud Function tự điền kana / romaji / nghĩa tiếng Việt / furigana cho các câu
 * tiếng Nhật, dùng Claude API.
 *
 * Vì sao proxy qua function thay vì gọi thẳng từ browser: gọi thẳng buộc phải nhúng
 * API key vào bundle JS, ai mở DevTools cũng lấy được và tiêu tiền trên tài khoản bạn.
 * Function giữ khoá trong Secret Manager. Xem docs/shadowing-feature.md §B4.5
 *
 * YÊU CẦU:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *   firebase deploy --only functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");
const { z } = require("zod");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

/** ⚠️ THAY bằng uid thật — Firebase Console → Authentication → Users */
const OWNER_UID = process.env.SHADOWING_OWNER_UID || "REPLACE_WITH_YOUR_UID";

/** Gửi theo lô; 20 câu/lần là cân bằng giữa số request và độ dài response */
const MAX_LINES_PER_CALL = 20;

const Token = z.object({
  t: z.string(),
  r: z.string().optional(),
});

const EnrichedLine = z.object({
  id: z.number(),
  kana: z.string(),
  romaji: z.string(),
  vi: z.string(),
  tokens: z.array(Token),
});

const EnrichResult = z.object({ lines: z.array(EnrichedLine) });

const SYSTEM = `Bạn là trợ lý soạn giáo trình shadowing tiếng Nhật.

Với mỗi câu tiếng Nhật được cung cấp, trả về:
- kana: cách đọc TOÀN câu bằng hiragana. Không dấu câu, không khoảng trắng.
- romaji: chuyển tự Hepburn của kana, các từ cách nhau bằng khoảng trắng.
- vi: nghĩa tiếng Việt tự nhiên, ngắn gọn, đúng sắc thái.
- tokens: cắt câu thành các đoạn liên tiếp.

Quy tắc cho tokens (quan trọng nhất):
- Ghép tất cả "t" lại theo thứ tự PHẢI ra đúng bằng câu gốc, không thêm hay bớt
  một ký tự nào, kể cả dấu câu và khoảng trắng.
- Đoạn nào chứa kanji thì có "r" là cách đọc hiragana của riêng đoạn đó.
- Đoạn thuần kana, dấu câu hoặc ký hiệu thì KHÔNG có "r".
- Với okurigana, chỉ đưa phần kanji vào đoạn có "r":
  遅れる -> [{"t":"遅","r":"おく"}, {"t":"れる"}]
  流れます -> [{"t":"流","r":"なが"}, {"t":"れます"}]

Chú ý cách đọc phụ thuộc ngữ cảnh:
- 一分 là いっぷん (không phải いちふん); 一杯 là いっぱい
- 明日 thường là あした, 今日 là きょう, 今朝 là けさ
- Tên riêng: chọn cách đọc phổ biến nhất.`;

const KANA_ONLY = /^[ぁ-ゖァ-ヺー々]+$/;
const HAS_KANJI = /[一-鿿々]/;

/**
 * Hậu kiểm trước khi trả về client.
 *
 * Bất biến jp === tokens.map(t => t.t).join("") là chỗ dễ vỡ nhất của toàn bộ dữ liệu —
 * lệch một ký tự là so khớp Speech-to-Text sai theo. Lệch thì HẠ CẤP xuống một đoạn
 * không furigana và báo rõ, chứ không gọi lại mù (gọi lại vẫn có thể sai lần nữa).
 */
function verifyLine(result, originalById) {
  const jp = originalById.get(result.id) || "";
  const problems = [];

  let tokens = Array.isArray(result.tokens) ? result.tokens : [];

  if (tokens.length && tokens.map((t) => t.t).join("") !== jp) {
    problems.push("furigana ghép lại không khớp câu gốc — đã hạ cấp, cần gắn tay");
    tokens = [{ t: jp }];
  }
  if (!tokens.length) tokens = [{ t: jp }];

  tokens = tokens.map((token) => {
    if (!token.r) return { t: token.t };
    if (!HAS_KANJI.test(token.t) || !KANA_ONLY.test(token.r)) {
      problems.push(`furigana không hợp lệ ở "${token.t}" — đã bỏ`);
      return { t: token.t };
    }
    return { t: token.t, r: token.r };
  });

  const kana = KANA_ONLY.test(result.kana || "") ? result.kana : "";
  if (result.kana && !kana) problems.push("kana trả về không hợp lệ — để trống");

  return {
    id: result.id,
    kana,
    romaji: typeof result.romaji === "string" ? result.romaji : "",
    vi: typeof result.vi === "string" ? result.vi : "",
    tokens,
    problems,
  };
}

exports.enrichShadowingLines = onCall(
  {
    region: "asia-southeast1",
    secrets: [ANTHROPIC_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 120,
    maxInstances: 3,
  },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid || uid !== OWNER_UID) {
      throw new HttpsError("permission-denied", "Tài khoản này không được phép dùng.");
    }

    const lines = request.data && request.data.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new HttpsError("invalid-argument", "Thiếu danh sách câu.");
    }
    if (lines.length > MAX_LINES_PER_CALL) {
      throw new HttpsError(
        "invalid-argument",
        `Tối đa ${MAX_LINES_PER_CALL} câu mỗi lần gọi.`
      );
    }

    const payload = [];
    const originalById = new Map();
    for (const line of lines) {
      const id = Number(line && line.id);
      const jp = typeof (line && line.jp) === "string" ? line.jp.trim() : "";
      if (!Number.isFinite(id) || !jp) continue;
      originalById.set(id, jp);
      payload.push({ id, jp });
    }

    if (!payload.length) {
      throw new HttpsError("invalid-argument", "Không có câu nào hợp lệ.");
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let response;
    try {
      response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 8000,
        output_config: {
          effort: "low", // việc ngắn và có khuôn, không cần suy luận sâu
          format: zodOutputFormat(EnrichResult),
        },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      });
    } catch (err) {
      console.error("[enrichShadowingLines] API lỗi:", err);
      throw new HttpsError("internal", "Dịch vụ tự điền gặp lỗi. Thử lại sau.");
    }

    if (!response.parsed_output) {
      throw new HttpsError("internal", "Không đọc được kết quả trả về.");
    }

    return {
      lines: response.parsed_output.lines
        .filter((line) => originalById.has(line.id))
        .map((line) => verifyLine(line, originalById)),
    };
  }
);
