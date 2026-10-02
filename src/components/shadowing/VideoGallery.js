import React, { useCallback, useEffect, useState } from "react";
import { MdDeleteOutline, MdRefresh, MdArrowBack } from "react-icons/md";
import { listVideos, deleteVideo } from "../../lib/videoStore";
import { formatTime } from "../../lib/audio";

/**
 * Danh sách bài học đã lưu trên Firebase, dạng thẻ có ảnh thu nhỏ.
 * Chọn một thẻ là mở bài đó ra luyện tập.
 */
export const VideoGallery = ({ onPick, onBack }) => {
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const list = await listVideos();
      setItems(list);
      setStatus(list.length ? "ready" : "empty");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err && err.message ? err.message : "Không tải được danh sách.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (item, event) => {
      event.stopPropagation(); // đừng mở bài khi người ta bấm nút xoá
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Xoá "${item.title || item.videoId}" khỏi Firebase? Không khôi phục được.`)) {
        return;
      }
      setBusyId(item.videoId);
      try {
        await deleteVideo(item.videoId);
        setItems((prev) => prev.filter((x) => x.videoId !== item.videoId));
      } catch (err) {
        setErrorMessage(err && err.message ? err.message : "Xoá không thành công.");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  return (
    <div className="sd-card">
      <div className="sd-gallery__head">
        <button type="button" className="sd-ghost-btn" onClick={onBack}>
          <MdArrowBack /> Quay lại
        </button>
        <p className="sd-choose-title" style={{ margin: 0 }}>
          Bài học trên Firebase
        </p>
        <span className="sd-sess-spacer" />
        <button type="button" className="sd-ghost-btn" onClick={load} disabled={status === "loading"}>
          <MdRefresh /> Tải lại
        </button>
      </div>

      {status === "loading" && (
        <div className="sd-stt__loading">
          <span className="sd-dots">
            <i />
            <i />
            <i />
          </span>
          Đang tải danh sách…
        </div>
      )}

      {status === "error" && (
        <div className="sd-validate is-bad" role="alert">
          <b>Không tải được danh sách</b>
          <p className="sd-validate__foot">{errorMessage}</p>
        </div>
      )}

      {status === "empty" && (
        <p className="sd-empty">
          Chưa có bài nào trên Firebase. Soạn một bài rồi bấm <b>“Lưu lên Firebase”</b>.
        </p>
      )}

      {status === "ready" && (
        <>
          {errorMessage && (
            <p className="sd-action-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="sd-gallery">
            {items.map((item) => (
              <button
                type="button"
                key={item.videoId}
                className="sd-vcard"
                onClick={() => onPick(item.videoId)}
                disabled={busyId === item.videoId}
              >
                <span className="sd-vcard__thumb">
                  <img src={item.thumbnail} alt="" loading="lazy" />
                  {item.durationSec > 0 && (
                    <span className="sd-vcard__dur">{formatTime(item.durationSec)}</span>
                  )}
                </span>

                <span className="sd-vcard__body">
                  <b className="sd-vcard__title" lang="ja">
                    {item.title || item.videoId}
                  </b>
                  {item.titleVi && <span className="sd-vcard__sub">{item.titleVi}</span>}

                  <span className="sd-vcard__meta">
                    {item.level && <em className="sd-vcard__level">{item.level}</em>}
                    <span>{item.lineCount} câu</span>
                    {item.updatedAt && (
                      <span>· {new Date(item.updatedAt).toLocaleDateString("vi-VN")}</span>
                    )}
                  </span>
                </span>

                <span
                  className="sd-vcard__del"
                  role="button"
                  tabIndex={0}
                  aria-label={`Xoá ${item.title || item.videoId}`}
                  title="Xoá khỏi Firebase"
                  onClick={(event) => handleDelete(item, event)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") handleDelete(item, event);
                  }}
                >
                  <MdDeleteOutline />
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
