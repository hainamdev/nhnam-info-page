import React, { useCallback, useRef, useState } from "react";
import { MdSmartDisplay, MdDataObject, MdCloudDownload } from "react-icons/md";

import { parseYouTubeId } from "../../lib/youtubeUrl";
import { readVideoFile } from "../../lib/sessionIO";

/**
 * Màn hình chọn khi chưa có phiên nào: nhập link YouTube để tự soạn, hoặc import
 * file JSON đã có. Bên dưới có lối tắt mở bài mẫu để thử ngay.
 */
export const SessionChooser = ({ onStartAuthor, onImport, onOpenSample, onOpenFirebase, firebaseReady, notice }) => {
  const [mode, setMode] = useState(null); // "youtube" | "json"
  const [urlInput, setUrlInput] = useState("");
  const [problems, setProblems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const parsedId = parseYouTubeId(urlInput);

  const handleStartAuthor = useCallback(() => {
    if (!parsedId) {
      setProblems(["Không nhận ra link YouTube. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…"]);
      return;
    }
    setProblems([]);
    onStartAuthor(parsedId);
  }, [parsedId, onStartAuthor]);

  const handleFile = useCallback(
    async (file) => {
      setProblems([]);
      const { video, problems: found } = await readVideoFile(file);
      if (!video) {
        setProblems(found.length ? found : ["File không hợp lệ"]);
        return;
      }
      onImport(video, file.name);
    },
    [onImport]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="sd-card">
      {notice && <p className="sd-notice">{notice}</p>}

      <p className="sd-choose-title">Bắt đầu một phiên luyện tập</p>

      <div className="sd-choose-grid">
        <button
          type="button"
          className={`sd-choice${mode === "youtube" ? " is-active" : ""}`}
          onClick={() => setMode("youtube")}
          aria-pressed={mode === "youtube"}
        >
          <span className="sd-choice__ico">
            <MdSmartDisplay />
          </span>
          <b>Nhập link YouTube</b>
          <span className="sd-choice__desc">
            Tự tạo bài mới: dán link, gõ phụ đề theo video, xuất file JSON
          </span>
        </button>

        <button
          type="button"
          className={`sd-choice${mode === "json" ? " is-active" : ""}${dragging ? " is-drop" : ""}`}
          onClick={() => {
            setMode("json");
            if (fileRef.current) fileRef.current.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-pressed={mode === "json"}
        >
          <span className="sd-choice__ico">
            <MdDataObject />
          </span>
          <b>Import file JSON</b>
          <span className="sd-choice__desc">
            Mở bài đã soạn sẵn từ file .json trên máy (kéo thả vào đây cũng được)
          </span>
        </button>

        <button
          type="button"
          className={`sd-choice${mode === "firebase" ? " is-active" : ""}`}
          onClick={() => {
            setMode("firebase");
            onOpenFirebase();
          }}
          disabled={!firebaseReady}
          aria-pressed={mode === "firebase"}
          title={
            firebaseReady
              ? "Mở bài đã lưu trên Firebase"
              : "Cần cấu hình Firebase và đăng nhập"
          }
        >
          <span className="sd-choice__ico">
            <MdCloudDownload />
          </span>
          <b>Mở từ Firebase</b>
          <span className="sd-choice__desc">
            {firebaseReady
              ? "Chọn trong các bài bạn đã lưu trên Firebase"
              : "Cần cấu hình Firebase và đăng nhập ở trên"}
          </span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sd-file-input"
        onChange={(event) => {
          const file = event.target.files && event.target.files[0];
          if (file) handleFile(file);
          event.target.value = ""; // cho phép chọn lại cùng file
        }}
      />

      {mode === "youtube" && (
        <div className="sd-url-box">
          <label htmlFor="sd-yt-url">Link hoặc ID video</label>
          <div className="sd-url-row">
            <input
              id="sd-yt-url"
              type="text"
              value={urlInput}
              placeholder="https://www.youtube.com/watch?v=..."
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleStartAuthor();
              }}
              autoFocus
            />
            <button type="button" className="sd-primary-btn" onClick={handleStartAuthor}>
              Bắt đầu
            </button>
          </div>
          {urlInput.trim() !== "" &&
            (parsedId ? (
              <p className="sd-url-ok">
                Nhận ra: <code>{parsedId}</code>
              </p>
            ) : (
              <p className="sd-url-bad">Chưa nhận ra link YouTube</p>
            ))}
        </div>
      )}

      {problems.length > 0 && (
        <div className="sd-validate is-bad" role="alert">
          <b>Không mở được file</b>
          <ul>
            {problems.slice(0, 8).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          {problems.length > 8 && <p className="sd-validate__foot">…và {problems.length - 8} lỗi khác</p>}
        </div>
      )}

      <p className="sd-hint sd-choose-foot">
        Dữ liệu lưu tạm trong trình duyệt này. Nhớ xuất JSON trước khi đóng phiên.
        {" · "}
        <button type="button" className="sd-linklike" onClick={onOpenSample}>
          Thử bài mẫu
        </button>
      </p>
    </div>
  );
};
