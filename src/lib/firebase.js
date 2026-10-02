/**
 * Khởi tạo Firebase (lazy).
 *
 * Toàn bộ tính năng shadowing phase 1 chạy được KHÔNG CẦN Firebase. Module này chỉ
 * thức dậy khi đã khai báo đủ biến môi trường, dùng cho phase 2 (Speech-to-Text + lưu
 * lịch sử). Nếu thiếu config thì isFirebaseConfigured() trả false và UI hiện hướng dẫn
 * thay vì báo lỗi.
 *
 * Khai báo trong file .env.local (không commit):
 *   REACT_APP_FIREBASE_API_KEY=...
 *   REACT_APP_FIREBASE_AUTH_DOMAIN=my-page-39b31.firebaseapp.com
 *   REACT_APP_FIREBASE_PROJECT_ID=my-page-39b31
 *   REACT_APP_FIREBASE_STORAGE_BUCKET=my-page-39b31.appspot.com
 *   REACT_APP_FIREBASE_APP_ID=...
 *   REACT_APP_FUNCTIONS_REGION=asia-southeast1
 */

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const FUNCTIONS_REGION = process.env.REACT_APP_FUNCTIONS_REGION || "asia-southeast1";

let appPromise = null;

/**
 * @returns {boolean} đã khai báo đủ config chưa
 */
export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * Lấy Firebase app, khởi tạo lần đầu nếu cần.
 * Dùng dynamic import để SDK không nằm trong bundle ban đầu.
 */
export async function getFirebaseApp() {
  if (!isFirebaseConfigured()) throw new Error("Firebase chưa được cấu hình");
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp, getApps, getApp }) =>
      getApps().length ? getApp() : initializeApp(config)
    );
  }
  return appPromise;
}

export async function getFirestoreDb() {
  const app = await getFirebaseApp();
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(app);
}

export async function getFunctionsClient() {
  const app = await getFirebaseApp();
  const { getFunctions } = await import("firebase/functions");
  return getFunctions(app, FUNCTIONS_REGION);
}

/**
 * Đăng nhập Google — bắt buộc trước khi gọi Cloud Function (function kiểm tra uid).
 */
export async function signInWithGoogle() {
  const app = await getFirebaseApp();
  const { getAuth, signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
  const auth = getAuth(app);
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

export async function signOutUser() {
  const app = await getFirebaseApp();
  const { getAuth, signOut } = await import("firebase/auth");
  await signOut(getAuth(app));
}

/** Theo dõi trạng thái đăng nhập. Trả về hàm huỷ đăng ký. */
export async function watchAuth(callback) {
  const app = await getFirebaseApp();
  const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(getAuth(app), callback);
}

export async function getCurrentUser() {
  if (!isFirebaseConfigured()) return null;
  const app = await getFirebaseApp();
  const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  const auth = getAuth(app);
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}
