import React from "react";

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
        <button type="button" className="sd-primary-btn sm" onClick={onExport}>
          Xuất JSON
        </button>
      )}

      <button type="button" className="sd-ghost-btn" onClick={onClose}>
        Đóng phiên
      </button>
    </div>
  );
};
