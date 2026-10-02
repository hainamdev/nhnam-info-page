import { useCallback, useRef, useState } from "react";
import { getCurrentUser, getFunctionsClient, isFirebaseConfigured } from "../lib/firebase";
import { scoreTranscript } from "../lib/diff";

/**
 * Gọi Cloud Function `transcribeShadowing` để lấy text từ bản ghi.
 *
 * Gọi Google Speech-to-Text thẳng từ browser sẽ phải nhúng API key vào bundle JS —
 * ai mở DevTools cũng lấy được và tiêu tiền trên project. Vì vậy đi qua Cloud Function
 * giữ credential ở server. Xem docs/shadowing-feature.md §8.3
 *
 * status: unavailable | idle | loading | done | error
 */
export function useTranscribe() {
  const [status, setStatus] = useState(() => (isFirebaseConfigured() ? "idle" : "unavailable"));
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [score, setScore] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const lastArgsRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(isFirebaseConfigured() ? "idle" : "unavailable");
    setTranscript("");
    setConfidence(0);
    setScore(null);
    setErrorMessage(null);
    lastArgsRef.current = null;
  }, []);

  /**
   * @param {{audioBase64: string, sampleRate: number, videoId: string, line: object, videoTimeAtStart?: number}} args
   */
  const transcribe = useCallback(async (args) => {
    if (!isFirebaseConfigured()) {
      setStatus("unavailable");
      return;
    }

    lastArgsRef.current = args;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatus("error");
        setErrorMessage("Cần đăng nhập trước khi dùng nhận dạng giọng nói.");
        return;
      }

      const functions = await getFunctionsClient();
      const { httpsCallable } = await import("firebase/functions");
      const call = httpsCallable(functions, "transcribeShadowing");

      const response = await call({
        audioBase64: args.audioBase64,
        sampleRate: args.sampleRate,
        videoId: args.videoId,
        lineId: args.line ? args.line.id : null,
        refText: args.line ? args.line.jp : "",
        videoTimeAtStart: args.videoTimeAtStart ?? null,
      });

      const data = response.data || {};
      const text = (data.transcript || "").trim();

      if (!text) {
        setStatus("error");
        setErrorMessage("Không nghe rõ — thử nói to hơn hoặc lại gần micro.");
        return;
      }

      setTranscript(text);
      setConfidence(data.confidence || 0);
      // Function đã tính score, nhưng tính lại ở client để UI vẫn chạy nếu function
      // trả thiếu trường (ví dụ bản function cũ)
      setScore(data.score || scoreTranscript(args.line ? args.line.jp : "", text));
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err && err.message
          ? `Không gọi được dịch vụ nhận dạng: ${err.message}`
          : "Không gọi được dịch vụ nhận dạng."
      );
    }
  }, []);

  const retry = useCallback(() => {
    if (lastArgsRef.current) transcribe(lastArgsRef.current);
  }, [transcribe]);

  return {
    status,
    transcript,
    confidence,
    score,
    errorMessage,
    transcribe,
    retry,
    reset,
    isAvailable: status !== "unavailable",
  };
}
