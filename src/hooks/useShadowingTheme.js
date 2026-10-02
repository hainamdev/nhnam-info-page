import { useCallback, useEffect, useState } from "react";

/**
 * Nền tối / sáng cho riêng trang shadowing.
 *
 * Không dùng `data-theme` của site vì themetoggle chung đang hard-code "light" và đã bị
 * gỡ khỏi header — phụ thuộc vào nó thì không đổi được gì.
 */

const KEY = "shadowing.theme";

function readStored() {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch (_) {
    return null; // chế độ riêng tư chặn localStorage
  }
}

export function useShadowingTheme() {
  const [theme, setTheme] = useState(() => readStored() || "dark");

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, theme);
    } catch (_) {
      /* không lưu được thì vẫn dùng được trong phiên này */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, isLight: theme === "light", toggle };
}
