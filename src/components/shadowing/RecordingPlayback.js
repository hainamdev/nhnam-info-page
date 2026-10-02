import React from "react";
import { formatTime } from "../../lib/audio";

/**
 * Thanh nghe lại bản ghi vừa thu. Dùng <audio controls> sẵn có của trình duyệt —
 * tự chạy được, không cần tự dựng seek bar.
 *
 * Theo quyết định Q3 thì không có nút tải xuống; bản ghi đi thẳng qua Speech-to-Text.
 */
export const RecordingPlayback = ({ result, onDiscard }) => {
  if (!result) return null;

  return (
    <div className="sd-playback">
      <p className="sd-blk-title">
        Bản ghi của bạn <span className="sd-blk-meta">{formatTime(result.durationMs / 1000)}</span>
      </p>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio className="sd-audio" src={result.url} controls preload="metadata" />

      <div className="sd-playback__actions">
        <button type="button" className="sd-ghost-btn" onClick={onDiscard}>
          Thu lại
        </button>
      </div>
    </div>
  );
};
