import React from "react";
import {
  MdPlayArrow,
  MdPause,
  MdVolumeUp,
  MdVolumeOff,
  MdMic,
  MdReplay5,
  MdForward5,
} from "react-icons/md";
import { formatTime } from "../../lib/audio";

/**
 * Hàng điều khiển: bật/tắt tiếng video, nút ghi âm, đồng hồ, và transport -5s / play / +5s.
 *
 * Đồng hồ hiển thị tiến độ CẢ VIDEO (không phải của riêng câu đang chạy).
 */
export const ControlBar = ({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  recorderStatus,
  recordElapsed,
  recordLevel,
  canRecord,
  onTogglePlay,
  onToggleMute,
  onToggleRecord,
  onSeekBy,
  disabled,
}) => {
  const isRecording = recorderStatus === "recording";
  const isRequesting = recorderStatus === "requesting";
  const recordBlocked = ["denied", "unsupported", "insecure"].includes(recorderStatus);

  let recordLabel = "Recording";
  if (isRequesting) recordLabel = "Đang xin quyền…";
  else if (recordBlocked) recordLabel = "Không dùng được mic";

  return (
    <div className="sd-controls">
      <div className="sd-controls__row">
        <button
          type="button"
          className={`sd-toggle${isMuted ? " is-off" : ""}`}
          onClick={onToggleMute}
          disabled={disabled}
          aria-pressed={!isMuted}
          title={isMuted ? "Bật tiếng video" : "Tắt tiếng video (nên tắt khi thu)"}
        >
          <span className="sd-toggle__ico">{isMuted ? <MdVolumeOff /> : <MdVolumeUp />}</span>
          {isMuted ? "OFF" : "ON"}
        </button>

        <button
          type="button"
          className={`sd-toggle sd-toggle--rec${isRecording ? " is-recording" : ""}`}
          onClick={onToggleRecord}
          disabled={recordBlocked || isRequesting || (!canRecord && !isRecording)}
          aria-pressed={isRecording}
          title={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
        >
          <span className="sd-toggle__ico">
            {isRecording ? <span className="sd-rec-dot" /> : <MdMic />}
          </span>
          {recordLabel}
          {isRecording && <span className="sd-rec-time">{formatTime(recordElapsed)}</span>}
        </button>
      </div>

      {isRecording && (
        <div className="sd-level" aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.min(1, (recordLevel || 0) * 2.2)})` }} />
        </div>
      )}

      <p className="sd-time">
        <b>{formatTime(currentTime)}</b> <span>/ {formatTime(duration)}</span>
      </p>

      <div className="sd-transport">
        <button
          type="button"
          className="sd-tbtn"
          onClick={() => onSeekBy(-5)}
          disabled={disabled}
          aria-label="Lùi 5 giây"
          title="Lùi 5 giây"
        >
          <MdReplay5 />
        </button>

        <button
          type="button"
          className="sd-tbtn sd-tbtn--main"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={isPlaying ? "Tạm dừng" : "Phát"}
          title={isPlaying ? "Tạm dừng" : "Phát"}
        >
          {isPlaying ? <MdPause /> : <MdPlayArrow />}
        </button>

        <button
          type="button"
          className="sd-tbtn"
          onClick={() => onSeekBy(5)}
          disabled={disabled}
          aria-label="Tới 5 giây"
          title="Tới 5 giây"
        >
          <MdForward5 />
        </button>
      </div>
    </div>
  );
};
