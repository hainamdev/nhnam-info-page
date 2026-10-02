import React from "react";

/**
 * Kết quả Speech-to-Text: transcript nhận dạng được, tô màu từng cụm so với câu gốc.
 *
 * Luôn hiện transcript thô bên cạnh câu gốc, vì điểm "độ khớp" chỉ là tham khảo —
 * Google STT trả về kanji và có thể chọn chữ khác dù phát âm đúng.
 */

const OP_CLASS = {
  equal: "is-eq",
  replace: "is-rp",
  insert: "is-in",
  delete: "is-de",
};

function scoreTone(accuracy) {
  if (accuracy >= 0.9) return "is-good";
  if (accuracy >= 0.6) return "is-mid";
  return "is-bad";
}

export const TranscriptResult = ({
  status,
  transcript,
  score,
  errorMessage,
  refText,
  onRetry,
  onRecordAgain,
}) => {
  if (status === "unavailable") {
    return (
      <div className="sd-stt sd-stt--hint">
        <p className="sd-blk-title">Nhận dạng giọng nói</p>
        <p className="sd-hint">
          Chưa bật. Cần cấu hình Firebase và deploy Cloud Function <code>transcribeShadowing</code>{" "}
          — xem <code>docs/shadowing-feature.md</code> §8.3. Phần ghi âm và nghe lại vẫn dùng bình
          thường.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="sd-stt">
        <div className="sd-stt__loading">
          <span className="sd-dots">
            <i />
            <i />
            <i />
          </span>
          Đang nhận dạng giọng nói…
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="sd-stt">
        <div className="sd-banner sd-banner--warn" role="alert">
          <div>
            <p>{errorMessage || "Không nhận dạng được."}</p>
            <p className="sd-banner__sub">Bản ghi vẫn được giữ lại, bạn có thể thử lại.</p>
            <div className="sd-playback__actions">
              <button type="button" className="sd-ghost-btn" onClick={onRetry}>
                Nhận dạng lại
              </button>
              <button type="button" className="sd-ghost-btn" onClick={onRecordAgain}>
                Thu lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status !== "done" || !score) return null;

  const percent = Math.round(score.accuracy * 100);

  return (
    <div className="sd-stt">
      <div className="sd-stt__head">
        <p className="sd-blk-title">Bạn đã đọc</p>
        <span className={`sd-score ${scoreTone(score.accuracy)}`}>
          {percent}%<small>độ khớp</small>
        </span>
      </div>

      <p className="sd-hyp" lang="ja">
        {score.diff && score.diff.length
          ? score.diff.map((part, index) => (
              <span key={index} className={OP_CLASS[part.op] || ""}>
                {part.op === "delete" ? part.text : part.text}
              </span>
            ))
          : transcript}
      </p>

      <p className="sd-ref">
        Câu gốc:{" "}
        <b lang="ja">{refText}</b>
      </p>

      <div className="sd-legend" aria-hidden="true">
        <span className="is-eq">■ khớp</span>
        <span className="is-rp">■ đọc sai</span>
        <span className="is-de">■ thiếu</span>
        <span className="is-in">■ thừa</span>
      </div>

      <p className="sd-caveat">
        Điểm độ khớp chỉ mang tính <b>tham khảo</b>: Google STT trả về kanji và có thể chọn chữ khác
        với câu gốc dù bạn phát âm hoàn toàn đúng (例: 下さい ↔ ください). Hãy đối chiếu transcript
        bằng mắt.
      </p>

      <div className="sd-playback__actions">
        <button type="button" className="sd-ghost-btn" onClick={onRecordAgain}>
          Thu lại
        </button>
        <button type="button" className="sd-ghost-btn" onClick={onRetry}>
          Nhận dạng lại
        </button>
      </div>
    </div>
  );
};
