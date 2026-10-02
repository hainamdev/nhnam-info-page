import { useCallback, useEffect, useState } from "react";
import { isFirebaseConfigured, signInWithGoogle, signOutUser, watchAuth } from "../lib/firebase";

/**
 * Trạng thái đăng nhập Firebase.
 *
 * Cả nhận dạng giọng nói lẫn tự điền đều gọi Cloud Function, mà function kiểm
 * request.auth.uid === OWNER_UID. Không đăng nhập thì hai tính năng đó không chạy được,
 * nên phải có lối đăng nhập trên giao diện.
 *
 * status: unavailable | loading | signed-out | signed-in | error
 */
export function useFirebaseAuth() {
  const [status, setStatus] = useState(() => (isFirebaseConfigured() ? "loading" : "unavailable"));
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return undefined;

    let cancelled = false;
    let unsubscribe;

    watchAuth((nextUser) => {
      if (cancelled) return;
      setUser(nextUser);
      setStatus(nextUser ? "signed-in" : "signed-out");
    })
      .then((fn) => {
        if (cancelled) fn();
        else unsubscribe = fn;
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Không khởi tạo được Firebase Auth.");
        }
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = err && err.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      setErrorMessage(
        code === "auth/popup-blocked"
          ? "Trình duyệt chặn cửa sổ đăng nhập — cho phép popup rồi thử lại."
          : `Đăng nhập thất bại${code ? ` (${code})` : ""}.`
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (_) {
      /* bỏ qua */
    }
  }, []);

  return {
    status,
    user,
    errorMessage,
    isAvailable: status !== "unavailable",
    isSignedIn: status === "signed-in",
    signIn,
    signOut,
  };
}
