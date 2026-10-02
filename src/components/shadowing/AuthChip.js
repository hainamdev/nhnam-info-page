import React from "react";
import { MdLockOutline, MdCheckCircleOutline } from "react-icons/md";

/**
 * Lối đăng nhập cho hai tính năng cần Cloud Function (nhận dạng giọng nói, tự điền).
 *
 * Không hiện gì khi Firebase chưa cấu hình — lúc đó chính hai tính năng kia đã tự
 * giải thích là chưa bật, thêm một thông báo nữa chỉ gây nhiễu.
 */
export const AuthChip = ({ auth }) => {
  if (!auth.isAvailable || auth.status === "loading") return null;

  if (auth.isSignedIn) {
    return (
      <div className="sd-auth sd-auth--on">
        <MdCheckCircleOutline />
        <span>
          Đã đăng nhập{auth.user && auth.user.email ? ` · ${auth.user.email}` : ""}
        </span>
        <span className="sd-sess-spacer" />
        <button type="button" className="sd-ghost-btn" onClick={auth.signOut}>
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="sd-auth">
      <MdLockOutline />
      <span>Đăng nhập để dùng nhận dạng giọng nói và tự điền.</span>
      <span className="sd-sess-spacer" />
      <button type="button" className="sd-primary-btn sm" onClick={auth.signIn}>
        Đăng nhập Google
      </button>
      {auth.errorMessage && <p className="sd-auth__err">{auth.errorMessage}</p>}
    </div>
  );
};
