import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "../../lib/audio";

/**
 * Thanh tua thời gian của video.
 *
 * Player YouTube chạy với controls: 0 (dùng điều khiển tự thiết kế), nên phải tự dựng
 * thanh tua. Bù lại nó dùng được cả ở chế độ luyện tập lẫn soạn bài, và hiển thị được
 * mốc các câu — thứ thanh gốc của YouTube không làm được.
 *
 * Trong lúc kéo thì hiển thị theo vị trí kéo, không theo currentTime, nếu không con trỏ
 * sẽ giật về chỗ cũ mỗi vòng poll.
 */
export const SeekBar = ({ currentTime, duration, onSeek, disabled, lines }) => {
  const trackRef = useRef(null);
  const [dragValue, setDragValue] = useState(null);

  const total = duration > 0 ? duration : 0;
  const shown = dragValue !== null ? dragValue : currentTime;
  const percent = total > 0 ? Math.min(100, Math.max(0, (shown / total) * 100)) : 0;

  const timeFromEvent = useCallback(
    (clientX) => {
      const track = trackRef.current;
      if (!track || total <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(total, Math.max(0, ratio * total));
    },
    [total]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (disabled || total <= 0) return;
      event.preventDefault();
      setDragValue(timeFromEvent(event.clientX));
    },
    [disabled, total, timeFromEvent]
  );

  // Gắn lên window để kéo ra ngoài thanh vẫn theo được
  useEffect(() => {
    if (dragValue === null) return undefined;

    const onMove = (event) => setDragValue(timeFromEvent(event.clientX));
    const onUp = (event) => {
      const value = timeFromEvent(event.clientX);
      setDragValue(null);
      onSeek(value);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragValue, timeFromEvent, onSeek]);

  const handleKeyDown = useCallback(
    (event) => {
      if (disabled || total <= 0) return;
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        onSeek(Math.max(0, currentTime - step));
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        onSeek(Math.min(total, currentTime + step));
      } else if (event.key === "Home") {
        event.preventDefault();
        onSeek(0);
      } else if (event.key === "End") {
        event.preventDefault();
        onSeek(total);
      }
    },
    [disabled, total, currentTime, onSeek]
  );

  return (
    <div className={`sd-seek${disabled ? " is-disabled" : ""}`}>
      <span className="sd-seek__t">{formatTime(shown)}</span>

      <div
        ref={trackRef}
        className="sd-seek__track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Thanh tua thời gian video"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatTime(shown)} trên ${formatTime(total)}`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        {/* Mốc các câu đã nhập — soạn bài nhìn vào đây biết chỗ nào còn trống */}
        {total > 0 &&
          (lines || []).map((line) => (
            <i
              key={line.id}
              className="sd-seek__mark"
              style={{ left: `${Math.min(100, (line.start / total) * 100)}%` }}
            />
          ))}

        <div className="sd-seek__fill" style={{ width: `${percent}%` }} />
        <div className={`sd-seek__knob${dragValue !== null ? " is-dragging" : ""}`} style={{ left: `${percent}%` }} />
      </div>

      <span className="sd-seek__t sd-seek__t--total">{formatTime(total)}</span>
    </div>
  );
};
