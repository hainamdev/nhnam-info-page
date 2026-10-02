/**
 * Lưu / đọc bài học trên Firestore.
 *
 * Document id = chính videoId của YouTube, nên lưu lại cùng một video là ghi đè bài cũ
 * chứ không sinh bản trùng. Shape giữ nguyên của `shadowing_videos/{videoId}` (docs §7),
 * cùng shape với file JSON xuất ra — nên xuất file, import file và lưu Firebase đều là
 * một dạng dữ liệu.
 */

import { getFirestoreDb, getCurrentUser, isFirebaseConfigured } from "./firebase";
import { buildExportPayload, sanitizeVideo } from "./sessionIO";

export const COLLECTION = "shadowing_videos";

async function requireUser() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase chưa được cấu hình.");
  }
  const user = await getCurrentUser();
  if (!user) throw new Error("Cần đăng nhập trước khi dùng Firebase.");
  return user;
}

/**
 * Lưu bài học. Ghi đè nếu videoId đã tồn tại.
 * @returns {Promise<{videoId: string, updatedAt: string}>}
 */
export async function saveVideo(video) {
  const user = await requireUser();
  const db = await getFirestoreDb();
  const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const payload = buildExportPayload(video);

  await setDoc(doc(db, COLLECTION, payload.videoId), {
    ...payload,
    ownerUid: user.uid,
    // Dùng giờ máy chủ để sắp xếp danh sách không phụ thuộc đồng hồ máy người dùng
    updatedAt: serverTimestamp(),
    createdAt: payload.createdAt || serverTimestamp(),
  });

  return { videoId: payload.videoId, updatedAt: new Date().toISOString() };
}

/**
 * Danh sách bài học của người đang đăng nhập, mới nhất trước.
 * Chỉ lấy phần cần cho thẻ — không tải `lines` của mọi bài về chỉ để vẽ danh sách.
 */
export async function listVideos() {
  const user = await requireUser();
  const db = await getFirestoreDb();
  const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore");

  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("ownerUid", "==", user.uid), orderBy("updatedAt", "desc"))
  );

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    const updatedAt = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : null;
    return {
      videoId: docSnap.id,
      title: data.title || "",
      titleVi: data.titleVi || "",
      level: data.level || "",
      tags: data.tags || [],
      thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${docSnap.id}/hqdefault.jpg`,
      durationSec: data.durationSec || 0,
      lineCount: data.lineCount || (data.lines || []).length,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
    };
  });
}

/**
 * Tải một bài học đầy đủ.
 * Dữ liệu từ Firestore cũng đi qua sanitizeVideo như file JSON — document có thể đã bị
 * sửa tay trên Console, không có lý do gì tin nó hơn một file.
 */
export async function loadVideo(videoId) {
  await requireUser();
  const db = await getFirestoreDb();
  const { doc, getDoc } = await import("firebase/firestore");

  const snapshot = await getDoc(doc(db, COLLECTION, videoId));
  if (!snapshot.exists()) {
    return { video: null, problems: ["Bài học này không còn trên Firebase."] };
  }

  const raw = snapshot.data();
  // Timestamp của Firestore không phải JSON thuần — bỏ đi trước khi xác thực
  return sanitizeVideo({ ...raw, videoId: snapshot.id, createdAt: null, updatedAt: null });
}

export async function deleteVideo(videoId) {
  await requireUser();
  const db = await getFirestoreDb();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, COLLECTION, videoId));
}
