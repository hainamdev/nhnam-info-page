import React from "react";
import { MdCloudUpload, MdCloudDone } from "react-icons/md";

/**
 * Băng trên cùng của phiên: chế độ đang dùng, nguồn dữ liệu, và các nút xuất / đóng.
 */
export const SessionBar = ({
  mode,
  sourceName,
  videoId,
  lineCount,
  dirty,
  onExport,
  onClose,
  onSwitchToAuthor,
  onSaveToFirebase,
  firebaseReady,
  saveStatus,
  saveError,
}) => {
  const isAuthor = mode === "author";

  return (
    <div className="sd-sess-bar">
      <span className={`sd-sess-tag${isAuthor ? " is-author" : ""}`}>{isAuthor ? "TẠO" : "JSON"}</span>

      <span className="sd-sess-info">
        {isAuthor ? (
          <>
            Phiên tạo mới · <code>{videoId}</code>
          </>
        ) : (
          <>
            Phiên: <b>{sourceName || "không rõ nguồn"}</b>
          </>
        )}
        {` · ${lineCount} câu`}
      </span>

      {dirty && (
        <span className="sd-warn-dot" title="Có thay đổi chưa xuất ra file">
          chưa xuất JSON
        </span>
      )}

      <span className="sd-sess-spacer" />

      {!isAuthor && onSwitchToAuthor && (
        <button type="button" className="sd-ghost-btn" onClick={onSwitchToAuthor}>
          Chuyển sang sửa
        </button>
      )}

      {isAuthor && (
        <button
          type="button"
          className="sd-ghost-btn"
          onClick={onSaveToFirebase}
          disabled={!firebaseReady || saveStatus === "saving"}
          title={
            firebaseReady
              ? "Lưu bài này lên Firebase (ghi đè nếu đã có cùng videoId)"
              : "Cần cấu hình Firebase và đăng nhập"
          }
        >
          {saveStatus === "saved" ? <MdCloudDone /> : <MdCloudUpload />}
          {saveStatus === "saving" ? " Đang lưu…" : saveStatus === "saved" ? " Đã lưu" : " Lưu lên Firebase"}
        </button>
      )}

      {isAuthor && (
        <button type="button" className="sd-primary-btn sm" onClick={onExport}>
          Xuất JSON
        </button>
      )}

      <button type="button" className="sd-ghost-btn" onClick={onClose}>
        Đóng phiên
      </button>

      {saveError && <p className="sd-sess-err">{saveError}</p>}
    </div>
  );
};
