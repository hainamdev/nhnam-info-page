/**
 * Nhận diện video YouTube từ link người dùng dán vào.
 *
 * Phải kiểm chặt: videoId được ghép thẳng vào URL của iframe nhúng, nên chỉ chấp nhận
 * đúng 11 ký tự hợp lệ — không thì nhét được tham số lạ vào URL embed.
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = ["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"];

/**
 * @param {string} input link đầy đủ hoặc ID trần
 * @returns {string|null} videoId 11 ký tự, hoặc null nếu không nhận ra
 */
export function parseYouTubeId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // Dán thẳng ID
  if (YT_ID.test(raw)) return raw;

  // Thiếu scheme thì thêm tạm để URL() parse được ("youtu.be/abc" -> "https://youtu.be/abc")
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;

  let url;
  try {
    url = new URL(candidate);
  } catch (_) {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "");
  const ok = (value) => (value && YT_ID.test(value) ? value : null);

  if (host === "youtu.be") {
    return ok(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (YT_HOSTS.includes(host)) {
    if (url.pathname === "/watch") return ok(url.searchParams.get("v"));

    const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
    if (match) return ok(match[2]);
  }

  return null;
}

/** @param {string} videoId */
export function isValidVideoId(videoId) {
  return typeof videoId === "string" && YT_ID.test(videoId);
}

/** @param {string} videoId */
export function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** @param {string} videoId */
export function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
