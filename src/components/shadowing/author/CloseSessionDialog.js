import React from "react";

/**
 * Xác nhận đóng phiên. Chế độ soạn bài thì nêu rõ số câu sẽ mất và lần xuất gần nhất,
 * vì đóng phiên là xoá vĩnh viễn khỏi trình duyệt.
 */
export const CloseSessionDialog = ({ mode, lineCount, lastExportedAt, onExportThenClose, onClose, onCancel }) => {
  const isAuthor = mode === "author";

  const exported = lastExportedAt
    ? new Date(lastExportedAt).toLocaleString("vi-VN")
    : "chưa bao giờ";

  return (
    <div className="sd-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="sd-dlg-title">
      <div className="sd-dialog">
        <p className="sd-dialog__title" id="sd-dlg-title">
          {isAuthor ? "Đóng phiên tạo mới?" : "Đóng phiên?"}
        </p>

        {isAuthor ? (
          <>
            <p>
              Toàn bộ <b>{lineCount} câu</b> đã nhập sẽ bị xoá khỏi trình duyệt và{" "}
              <b>không thể khôi phục</b>.
            </p>
            <p className="sd-dialog__meta">
              Lần xuất JSON gần nhất: <b className={lastExportedAt ? undefined : "sd-warn-t"}>{exported}</b>
            </p>
          </>
        ) : (
          <p>Dữ liệu đang mở sẽ bị xoá khỏi trình duyệt. File gốc trên máy bạn không bị ảnh hưởng.</p>
        )}

        <div className="sd-dialog__actions">
          {isAuthor && (
            <button type="button" className="sd-primary-btn" onClick={onExportThenClose}>
              Xuất JSON rồi đóng
            </button>
          )}
          <button type="button" className="sd-ghost-btn" onClick={onClose}>
            {isAuthor ? "Đóng luôn" : "Đóng phiên"}
          </button>
          <button type="button" className="sd-ghost-btn" onClick={onCancel}>
            Huỷ
          </button>
        </div>
      </div>
    </div>
  );
};
