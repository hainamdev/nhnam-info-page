import { useCallback, useState } from "react";
import { getCurrentUser, getFunctionsClient, isFirebaseConfigured } from "../lib/firebase";
import { joinTokens } from "../lib/lines";

/**
 * Tự điền kana / romaji / nghĩa / furigana cho các câu, qua Cloud Function
 * `enrichShadowingLines`.
 *
 * Gọi thẳng nhà cung cấp LLM từ browser sẽ phải nhúng API key vào bundle JS — ai mở
 * DevTools cũng lấy được. Function giữ khoá ở server. Xem docs §B4.5
 *
 * status: unavailable | idle | loading | done | error
 */

/** Gửi theo lô, không phải mỗi câu một request */
const BATCH_SIZE = 20;

const KANA_ONLY = /^[ぁ-ゖァ-ヺー々]+$/;
const HAS_KANJI = /[一-鿿々]/;

/**
 * Hậu kiểm ở client: dù function đã kiểm, vẫn không tin thẳng dữ liệu đi qua mạng.
 * Trả về bản đã làm sạch kèm danh sách vấn đề để hiện cho người dùng.
 */
export function verifyEnriched(result, jp) {
  const problems = [];
  let tokens = Array.isArray(result.tokens) ? result.tokens : [];

  // Bất biến quan trọng nhất: ghép tokens phải ra đúng jp
  if (tokens.length && joinTokens(tokens) !== jp) {
    problems.push("furigana ghép lại không khớp câu gốc — đã hạ cấp, cần gắn tay");
    tokens = [{ t: jp }];
  }

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
    kana,
    romaji: typeof result.romaji === "string" ? result.romaji : "",
    vi: typeof result.vi === "string" ? result.vi : "",
    tokens,
    problems,
  };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function useAutoFill() {
  const [status, setStatus] = useState(() => (isFirebaseConfigured() ? "idle" : "unavailable"));
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [report, setReport] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const reset = useCallback(() => {
    setStatus(isFirebaseConfigured() ? "idle" : "unavailable");
    setProgress({ done: 0, total: 0 });
    setReport(null);
    setErrorMessage(null);
  }, []);

  /**
   * @param {Array<{id:number, jp:string}>} lines câu cần điền
   * @param {(lineId:number, filled:object)=>void} onLine gọi cho từng câu có kết quả
   */
  const fill = useCallback(async (lines, onLine) => {
    if (!isFirebaseConfigured()) {
      setStatus("unavailable");
      return null;
    }

    const targets = (lines || []).filter((l) => l.jp && l.jp.trim());
    if (!targets.length) {
      setErrorMessage("Không có câu nào có nội dung tiếng Nhật để điền.");
      setStatus("error");
      return null;
    }

    setStatus("loading");
    setErrorMessage(null);
    setReport(null);
    setProgress({ done: 0, total: targets.length });

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatus("error");
        setErrorMessage("Cần đăng nhập trước khi dùng tự điền.");
        return null;
      }

      const functions = await getFunctionsClient();
      const { httpsCallable } = await import("firebase/functions");
      const call = httpsCallable(functions, "enrichShadowingLines");

      const ok = [];
      const needsReview = [];
      let done = 0;

      for (const batch of chunk(targets, BATCH_SIZE)) {
        const response = await call({ lines: batch.map((l) => ({ id: l.id, jp: l.jp })) });
        const results = (response.data && response.data.lines) || [];

        for (const result of results) {
          const origin = batch.find((l) => l.id === result.id);
          if (!origin) continue;

          const filled = verifyEnriched(result, origin.jp);
          const problems = [...(result.problems || []), ...filled.problems];

          if (onLine) onLine(origin.id, filled);
          if (problems.length) needsReview.push({ id: origin.id, problems });
          else ok.push(origin.id);
        }

        done += batch.length;
        setProgress({ done, total: targets.length });
      }

      setReport({ ok: ok.length, needsReview });
      setStatus("done");
      return { ok, needsReview };
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err && err.message ? `Không gọi được dịch vụ tự điền: ${err.message}` : "Không gọi được dịch vụ tự điền."
      );
      return null;
    }
  }, []);

  return {
    status,
    progress,
    report,
    errorMessage,
    isAvailable: status !== "unavailable",
    fill,
    reset,
  };
}
