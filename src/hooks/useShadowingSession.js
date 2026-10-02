import { useCallback, useEffect, useRef, useState } from "react";
import { isValidVideoId, watchUrl, thumbnailUrl } from "../lib/youtubeUrl";
import { SCHEMA_VERSION } from "../data/shadowing";

/**
 * Phiên làm việc của trang shadowing, lưu tạm trong localStorage.
 *
 * Một khoá duy nhất để "đóng phiên" chỉ là một lệnh removeItem.
 * Trường `video` giữ ĐÚNG shape của document Firestore shadowing_videos/{videoId},
 * nhờ vậy file xuất ra nạp lại được ngay và sau này đẩy lên Firestore không phải chuyển đổi.
 */

export const SESSION_KEY = "shadowing.session.v1";
export const SESSION_VERSION = 1;

const SAVE_DEBOUNCE_MS = 500;

/** booting | chooser | practice | author */
function emptyVideo(videoId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    videoId,
    provider: "youtube",
    url: watchUrl(videoId),
    thumbnail: thumbnailUrl(videoId),
    durationSec: 0,
    title: "",
    titleVi: "",
    level: "",
    tags: [],
    sourceChannel: "",
    lineCount: 0,
    lines: [],
    visibility: "private",
    ownerUid: "",
    createdAt: null,
    updatedAt: null,
  };
}

function readStored() {
  let raw;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch (_) {
    return null; // chế độ riêng tư chặn localStorage
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { corrupt: true };
  }

  const okMode = parsed && (parsed.mode === "author" || parsed.mode === "import");
  const okVideo = parsed && parsed.video && isValidVideoId(parsed.video.videoId);

  // Phiên hỏng thì xoá luôn — mở ra sẽ gây lỗi khó hiểu ở tầng dưới
  if (!parsed || parsed.sessionVersion !== SESSION_VERSION || !okMode || !okVideo) {
    return { corrupt: true };
  }
  return parsed;
}

export function useShadowingSession() {
  const [status, setStatus] = useState("booting");
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState(null);
  const [storageError, setStorageError] = useState(null);

  const saveTimerRef = useRef(null);
  const skipNextSaveRef = useRef(false);

  // Khởi động
  useEffect(() => {
    const stored = readStored();

    if (stored && stored.corrupt) {
      try {
        window.localStorage.removeItem(SESSION_KEY);
      } catch (_) {
        /* không xoá được thì thôi */
      }
      setNotice("Phiên cũ bị hỏng nên đã được xoá.");
      setStatus("chooser");
      return;
    }

    if (stored) {
      skipNextSaveRef.current = true; // vừa đọc lên, không cần ghi lại ngay
      setSession(stored);
      setStatus(stored.mode === "author" ? "author" : "practice");
      return;
    }

    setStatus("chooser");
  }, []);

  // Autosave có debounce — gõ phụ đề mà ghi mỗi phím là ghi hàng chục lần/giây vô ích
  useEffect(() => {
    if (!session) return undefined;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return undefined;
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setStorageError(null);
      } catch (err) {
        setStorageError(
          err && err.name === "QuotaExceededError"
            ? "Bộ nhớ trình duyệt đã đầy — hãy xuất JSON ngay để khỏi mất dữ liệu."
            : "Không lưu được vào trình duyệt — hãy xuất JSON để giữ dữ liệu."
        );
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [session]);

  // Tab khác sửa cùng phiên -> báo thay vì âm thầm ghi đè
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== SESSION_KEY) return;
      setNotice("Phiên đã thay đổi ở một tab khác. Tải lại trang để lấy bản mới nhất.");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openSession = useCallback((next) => {
    setSession(next);
    setStatus(next.mode === "author" ? "author" : "practice");
    setNotice(null);
  }, []);

  /** Mở bài đã có (import JSON hoặc bài mẫu) để luyện tập. */
  const startPractice = useCallback(
    (video, sourceName) => {
      const now = new Date().toISOString();
      openSession({
        sessionVersion: SESSION_VERSION,
        mode: "import",
        createdAt: now,
        updatedAt: now,
        sourceName: sourceName || null,
        lastExportedAt: null,
        video,
        autoFlags: {},
      });
    },
    [openSession]
  );

  /** Bắt đầu soạn bài mới từ một link YouTube. */
  const startAuthor = useCallback(
    (videoId) => {
      const now = new Date().toISOString();
      openSession({
        sessionVersion: SESSION_VERSION,
        mode: "author",
        createdAt: now,
        updatedAt: now,
        sourceName: null,
        lastExportedAt: null,
        video: emptyVideo(videoId),
        autoFlags: {},
      });
    },
    [openSession]
  );

  /** Chuyển phiên import sang chế độ sửa, giữ nguyên dữ liệu. */
  const switchToAuthor = useCallback(() => {
    setSession((prev) =>
      prev ? { ...prev, mode: "author", updatedAt: new Date().toISOString() } : prev
    );
    setStatus("author");
  }, []);

  /** Sửa phần `video`. updater nhận video cũ, trả video mới. */
  const updateVideo = useCallback((updater) => {
    setSession((prev) => {
      if (!prev) return prev;
      const nextVideo = typeof updater === "function" ? updater(prev.video) : updater;
      return {
        ...prev,
        video: { ...nextVideo, lineCount: (nextVideo.lines || []).length },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  /** Đánh dấu ô nào do máy điền, để "tự điền ô trống" không ghi đè thứ đã sửa tay. */
  const setAutoFlags = useCallback((lineId, flags) => {
    setSession((prev) => {
      if (!prev) return prev;
      const key = String(lineId);
      return {
        ...prev,
        autoFlags: { ...prev.autoFlags, [key]: { ...(prev.autoFlags || {})[key], ...flags } },
      };
    });
  }, []);

  const markExported = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, lastExportedAt: new Date().toISOString() } : prev));
  }, []);

  const closeSession = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (_) {
      /* bỏ qua */
    }
    setSession(null);
    setStatus("chooser");
    setNotice(null);
    setStorageError(null);
  }, []);

  const lineCount = session && session.video ? (session.video.lines || []).length : 0;
  const dirty =
    !!session &&
    lineCount > 0 &&
    (!session.lastExportedAt || session.lastExportedAt < session.updatedAt);

  return {
    status,
    session,
    notice,
    storageError,
    dirty,
    lineCount,
    startPractice,
    startAuthor,
    switchToAuthor,
    updateVideo,
    setAutoFlags,
    markExported,
    closeSession,
    dismissNotice: () => setNotice(null),
  };
}
