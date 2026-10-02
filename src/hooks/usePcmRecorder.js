import { useCallback, useEffect, useRef, useState } from "react";
import { encodeWav, floatToInt16, mergeFloat32, pcmToBase64 } from "../lib/audio";

/**
 * Ghi âm PCM thô bằng Web Audio, xuất ra WAV (LINEAR16 16kHz mono).
 *
 * Không dùng MediaRecorder vì Safari xuất audio/mp4 (AAC) mà Google Speech-to-Text
 * không hỗ trợ. Xem docs/shadowing-feature.md §8.2
 *
 * status: unsupported | insecure | idle | requesting | recording | stopped | denied | error
 */

const TARGET_SAMPLE_RATE = 16000;

/** speech:recognize đồng bộ giới hạn 60 giây — dừng sớm ở 55s cho an toàn */
export const MAX_RECORD_SECONDS = 55;

function detectSupport() {
  if (typeof window === "undefined") return "unsupported";
  // getUserMedia chỉ tồn tại trong secure context (https hoặc localhost)
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "unsupported";
  if (!window.AudioContext && !window.webkitAudioContext) return "unsupported";
  return "idle";
}

function mapError(err) {
  switch (err && err.name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        status: "denied",
        message:
          "Trình duyệt đang chặn micro. Bấm icon ổ khoá trên thanh địa chỉ → cho phép Microphone → tải lại trang.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return { status: "error", message: "Không tìm thấy micro trên thiết bị." };
    case "NotReadableError":
    case "TrackStartError":
      return {
        status: "error",
        message: "Micro đang bị ứng dụng khác chiếm (Zoom, Teams…). Đóng ứng dụng đó rồi thử lại.",
      };
    default:
      return {
        status: "error",
        message: "Không khởi động được micro. Thử tải lại trang.",
      };
  }
}

export function usePcmRecorder() {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState(null); // { url, blob, base64, sampleRate, durationMs }

  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const nodeRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const finalResolveRef = useRef(null);
  const objectUrlRef = useRef(null);
  const autoStopRef = useRef(null);

  useEffect(() => {
    setStatus(detectSupport());
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    try {
      if (sourceRef.current) sourceRef.current.disconnect();
      if (nodeRef.current) nodeRef.current.disconnect();
      if (gainRef.current) gainRef.current.disconnect();
    } catch (_) {
      /* đã ngắt rồi */
    }
    if (nodeRef.current) {
      nodeRef.current.onaudioprocess = null;
      if (nodeRef.current.port) nodeRef.current.port.onmessage = null;
    }
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      ctxRef.current.close().catch(() => {});
    }
    // Dừng track để đèn mic của trình duyệt tắt hẳn
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

    sourceRef.current = null;
    nodeRef.current = null;
    gainRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
  }, []);

  // Dọn dẹp khi unmount — thiếu bước này là đèn mic sáng mãi sau khi rời trang
  useEffect(
    () => () => {
      teardown();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [teardown]
  );

  const stop = useCallback(async () => {
    if (status !== "recording") return null;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    const sampleRate = ctxRef.current ? ctxRef.current.sampleRate : TARGET_SAMPLE_RATE;
    const node = nodeRef.current;

    // AudioWorklet gom mẫu theo khối, phần đuôi chưa đủ khối phải xin nó đẩy nốt
    if (node && node.port) {
      await new Promise((resolve) => {
        finalResolveRef.current = resolve;
        node.port.postMessage("flush");
        // Nếu worklet không trả lời (trình duyệt lạ) thì vẫn đi tiếp sau 300ms
        window.setTimeout(() => {
          if (finalResolveRef.current) {
            finalResolveRef.current = null;
            resolve();
          }
        }, 300);
      });
    }

    teardown();

    const merged = mergeFloat32(chunksRef.current);
    chunksRef.current = [];

    if (merged.length === 0) {
      setStatus("error");
      setErrorMessage("Không thu được âm thanh nào. Kiểm tra lại micro rồi thử lại.");
      return null;
    }

    const pcm = floatToInt16(merged);
    const blob = encodeWav(pcm, sampleRate);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const payload = {
      url,
      blob,
      base64: pcmToBase64(pcm),
      sampleRate,
      durationMs: Math.round((merged.length / sampleRate) * 1000),
      bytes: blob.size,
    };

    setResult(payload);
    setLevel(0);
    setStatus("stopped");
    return payload;
  }, [status, teardown]);

  // stop() thay đổi theo status nên giữ ref để timer auto-stop luôn gọi bản mới nhất
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    const support = detectSupport();
    if (support !== "idle") {
      setStatus(support);
      setErrorMessage(
        support === "insecure"
          ? "Ghi âm cần HTTPS (hoặc localhost). Mở trang qua https rồi thử lại."
          : "Trình duyệt này không hỗ trợ ghi âm."
      );
      return;
    }

    setErrorMessage(null);
    setStatus("requesting");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const mapped = mapError(err);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      // Để trình duyệt tự resample về 16kHz thay vì tự viết hàm downsample
      const ctx = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);

      // Đồ thị audio chỉ chạy khi có đường tới destination. Chèn gain = 0 để
      // không dội tiếng mic ra loa gây hú.
      const silent = ctx.createGain();
      silent.gain.value = 0;

      chunksRef.current = [];
      let node;

      if (ctx.audioWorklet) {
        await ctx.audioWorklet.addModule(`${process.env.PUBLIC_URL || ""}/pcm-worklet.js`);
        node = new window.AudioWorkletNode(ctx, "pcm-recorder");
        node.port.onmessage = (event) => {
          const { samples, peak, final } = event.data || {};
          if (samples && samples.length) chunksRef.current.push(samples);
          if (typeof peak === "number") setLevel(peak);
          if (final && finalResolveRef.current) {
            const resolve = finalResolveRef.current;
            finalResolveRef.current = null;
            resolve();
          }
        };
      } else {
        // Fallback cho trình duyệt cũ. ScriptProcessorNode đã deprecated nhưng chạy mọi nơi.
        node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          chunksRef.current.push(new Float32Array(input));
          let peak = 0;
          for (let i = 0; i < input.length; i += 16) {
            const v = Math.abs(input[i]);
            if (v > peak) peak = v;
          }
          setLevel(peak);
        };
      }

      source.connect(node);
      node.connect(silent);
      silent.connect(ctx.destination);

      streamRef.current = stream;
      ctxRef.current = ctx;
      sourceRef.current = source;
      nodeRef.current = node;
      gainRef.current = silent;

      startedAtRef.current = window.performance.now();
      setElapsed(0);
      setResult(null);
      setStatus("recording");

      timerRef.current = window.setInterval(() => {
        setElapsed((window.performance.now() - startedAtRef.current) / 1000);
      }, 200);

      autoStopRef.current = window.setTimeout(() => {
        stopRef.current();
      }, MAX_RECORD_SECONDS * 1000);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      teardown();
      setStatus("error");
      setErrorMessage("Không khởi tạo được bộ ghi âm. Thử tải lại trang.");
    }
  }, [teardown]);

  const reset = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setResult(null);
    setElapsed(0);
    setLevel(0);
    setErrorMessage(null);
    setStatus(detectSupport());
  }, []);

  return {
    status,
    errorMessage,
    elapsed,
    level,
    result,
    isRecording: status === "recording",
    isBusy: status === "requesting",
    canRecord: status === "idle" || status === "stopped" || status === "error",
    start,
    stop,
    reset,
  };
}
