import React from "react";
import { MdErrorOutline } from "react-icons/md";

/**
 * Banner cảnh báo khi không dùng được micro. Trang vẫn hoạt động bình thường
 * (video + phụ đề), chỉ riêng phần ghi âm bị khoá.
 */
export const PermissionBanner = ({ status, message, onRetry }) => {
  const blocking = ["denied", "unsupported", "insecure", "error"].includes(status);
  if (!blocking || !message) return null;

  return (
    <div className="sd-banner" role="alert">
      <span className="sd-banner__ico">
        <MdErrorOutline />
      </span>
      <div>
        <p>{message}</p>
        {status === "denied" && (
          <button type="button" className="sd-ghost-btn" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
};
