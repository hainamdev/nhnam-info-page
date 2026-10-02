import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bọc YouTube IFrame Player API thành hook React.
 *
 * Không dùng react-youtube để khỏi thêm dependency — phần khó duy nhất là nạp script
 * đúng một lần cho cả app, xử lý bằng singleton promise bên dưới.
 */

const YT_SRC = "https://www.youtube.com/iframe_api";

let ytPromise = null;

function loadYT() {
  if (ytPromise) return ytPromise;

  ytPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    // Không ghi đè callback có sẵn — script khác cũng có thể đang chờ nó
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };

    if (!document.querySelector(`script[src="${YT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = YT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytPromise;
}

/**
 * @param {string} videoId
 */
export function useYouTubePlayer(videoId) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  // Mốc thời gian mới nhất đã biết, kể cả seek chưa hoàn tất
  const timeRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // getDuration() tinh chỉnh lại sau khi nạp thêm metadata (vd 163.16 -> 162.98),
  // đủ để Math.floor đổi số và tổng thời lượng nhấp nháy 02:43 <-> 02:42.
  // Chỉ nhận giá trị mới khi lệch đáng kể.
  const applyDuration = useCallback((next) => {
    if (!next) return;
    setDuration((prev) => (Math.abs(prev - next) >= 0.5 ? next : prev));
  }, []);

  useEffect(() => {
    // Chụp lại node ngay trong effect — cleanup chạy sau khi ref có thể đã đổi
    const host = hostRef.current;
    if (!videoId || !host) return undefined;

    let cancelled = false;
    setReady(false);
    setError(null);
    timeRef.current = 0;
    setCurrentTime(0);

    loadYT().then((YT) => {
      if (cancelled) return;

      // YT.Player THAY THẾ hẳn phần tử đích bằng iframe. Nếu đưa node do React quản lý
      // thì lúc unmount React sẽ không tìm thấy node cũ và ném NotFoundError.
      // Vì vậy tạo node con bằng tay — React không biết tới nó.
      const mount = document.createElement("div");
      host.appendChild(mount);

      // eslint-disable-next-line no-new
      new YT.Player(mount, {
        videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1, // bắt buộc cho iOS, nếu không sẽ bật fullscreen native
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            applyDuration(event.target.getDuration());
            setIsMuted(Boolean(event.target.isMuted && event.target.isMuted()));
            setReady(true);
          },
          onStateChange: (event) => {
            if (cancelled) return;
            const State = window.YT.PlayerState;
            setIsPlaying(event.data === State.PLAYING);

            // Duration chỉ có giá trị thật sau khi metadata nạp xong
            const d = event.target.getDuration && event.target.getDuration();
            applyDuration(d);

            if (event.data === State.ENDED) {
              const t = event.target.getCurrentTime() || 0;
              timeRef.current = t;
              setCurrentTime(t);
            }
          },
          onError: (event) => {
            if (!cancelled) setError(event.data);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        if (playerRef.current && playerRef.current.destroy) playerRef.current.destroy();
      } catch (_) {
        /* player có thể đã bị gỡ, bỏ qua */
      }
      playerRef.current = null;
      host.innerHTML = "";
    };
  }, [videoId, applyDuration]);

  // Poll thời gian bằng rAF (có throttle) — trình duyệt tự dừng khi tab ẩn,
  // khác setInterval vẫn chạy tốn tài nguyên vô ích.
  useEffect(() => {
    if (!isPlaying) return undefined;

    let raf;
    let last = 0;
    const tick = (ts) => {
      if (ts - last >= 100) {
        last = ts;
        const player = playerRef.current;
        if (player && player.getCurrentTime) {
          const t = player.getCurrentTime() || 0;
          timeRef.current = t;
          setCurrentTime(t);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [isPlaying]);

  const play = useCallback(() => {
    if (playerRef.current) playerRef.current.playVideo();
  }, []);

  const pause = useCallback(() => {
    if (playerRef.current) playerRef.current.pauseVideo();
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, [isPlaying]);

  const seekTo = useCallback((seconds) => {
    const player = playerRef.current;
    if (!player) return;
    const total = player.getDuration() || 0;
    const next = Math.min(Math.max(seconds, 0), total || seconds);
    player.seekTo(next, true);
    timeRef.current = next;
    setCurrentTime(next); // cập nhật ngay, không chờ vòng poll kế tiếp
  }, []);

  /**
   * Tua tương đối, dùng cho hai nút -5s / +5s.
   *
   * Lấy mốc từ timeRef chứ không gọi getCurrentTime(): sau seekTo, player còn
   * trả về vị trí CŨ cho tới khi seek xong, nên bấm -5 hai lần liên tiếp sẽ chỉ
   * lùi 5s thay vì 10s.
   */
  const seekBy = useCallback(
    (delta) => {
      if (!playerRef.current) return;
      seekTo(timeRef.current + delta);
    },
    [seekTo]
  );

  const setMuted = useCallback((muted) => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.mute();
    else player.unMute();
    setIsMuted(muted);
  }, []);

  const toggleMute = useCallback(() => setMuted(!isMuted), [isMuted, setMuted]);

  const setPlaybackRate = useCallback((rate) => {
    if (playerRef.current) playerRef.current.setPlaybackRate(rate);
  }, []);

  return {
    hostRef,
    ready,
    isPlaying,
    isMuted,
    currentTime,
    duration,
    error,
    play,
    pause,
    togglePlay,
    seekTo,
    seekBy,
    setMuted,
    toggleMute,
    setPlaybackRate,
  };
}
