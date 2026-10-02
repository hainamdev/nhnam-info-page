/**
 * Nhập / xuất file JSON bài shadowing.
 *
 * File JSON do người dùng cung cấp là ĐẦU VÀO KHÔNG TIN ĐƯỢC. Mọi thứ đi qua đây đều
 * được chép lại theo danh sách trường cho phép — không `Object.assign` cả object lạ vào
 * state, nên khoá bất thường (kể cả "__proto__") bị bỏ luôn.
 */

import { isValidVideoId, watchUrl, thumbnailUrl } from "./youtubeUrl";
import { SCHEMA_VERSION } from "../data/shadowing";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_LINES = 2000;

const LINE_FIELDS = ["id", "start", "end", "jp", "kana", "romaji", "vi", "tokens", "note"];
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const str = (value) => (typeof value === "string" ? value : "");
const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function sanitizeTokens(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((token) => token && typeof token === "object" && typeof token.t === "string")
    .map((token) => (typeof token.r === "string" && token.r ? { t: token.t, r: token.r } : { t: token.t }));
}

function sanitizeLine(raw, index, problems) {
  if (!raw || typeof raw !== "object") {
    problems.push(`Câu thứ ${index + 1}: không phải object`);
    return null;
  }

  const out = {};
  for (const key of LINE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = raw[key];
  }

  const id = num(out.id);
  const start = num(out.start);
  // end có thể là null = câu đang mở (file xuất từ phiên soạn dở)
  const end = out.end === null || out.end === undefined ? null : num(out.end);

  if (id === null) problems.push(`Câu thứ ${index + 1}: thiếu id hoặc id không phải số`);
  if (start === null || start < 0) problems.push(`Câu thứ ${index + 1}: start không hợp lệ`);
  if (end !== null && start !== null && end <= start) {
    problems.push(`Câu thứ ${index + 1}: end (${end}) phải lớn hơn start (${start})`);
  }
  if (!str(out.jp)) problems.push(`Câu thứ ${index + 1}: thiếu jp`);

  return {
    id: id === null ? index + 1 : id,
    start: start === null ? 0 : start,
    end,
    jp: str(out.jp),
    kana: str(out.kana),
    romaji: str(out.romaji),
    vi: str(out.vi),
    tokens: sanitizeTokens(out.tokens),
    note: str(out.note),
  };
}

/**
 * Chuẩn hoá + xác thực một object bài học đọc từ JSON.
 * @returns {{video: object|null, problems: string[]}}
 */
export function sanitizeVideo(raw) {
  const problems = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { video: null, problems: ["File không phải một object JSON hợp lệ"] };
  }

  const videoId = str(raw.videoId).trim();
  if (!isValidVideoId(videoId)) {
    // Chặn TRƯỚC khi ghép vào URL iframe
    problems.push('Trường "videoId" phải đúng 11 ký tự YouTube hợp lệ');
  }

  if (!Array.isArray(raw.lines)) {
    problems.push('Trường "lines" phải là một mảng');
    return { video: null, problems };
  }
  if (raw.lines.length > MAX_LINES) {
    problems.push(`Quá nhiều câu (${raw.lines.length}), tối đa ${MAX_LINES}`);
    return { video: null, problems };
  }

  const lines = raw.lines.map((line, i) => sanitizeLine(line, i, problems)).filter(Boolean);

  const ids = lines.map((l) => l.id);
  if (new Set(ids).size !== ids.length) problems.push("id của các câu bị trùng nhau");

  if (problems.length) return { video: null, problems };

  const level = LEVELS.includes(raw.level) ? raw.level : "";

  return {
    problems: [],
    video: {
      schemaVersion: SCHEMA_VERSION,
      videoId,
      provider: "youtube",
      url: str(raw.url) || watchUrl(videoId),
      thumbnail: str(raw.thumbnail) || thumbnailUrl(videoId),
      durationSec: num(raw.durationSec) || 0,
      title: str(raw.title),
      titleVi: str(raw.titleVi),
      level,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string") : [],
      sourceChannel: str(raw.sourceChannel),
      lineCount: lines.length,
      lines,
      visibility: "private",
      ownerUid: "",
      createdAt: null,
      updatedAt: null,
    },
  };
}

/**
 * Đọc File từ <input type="file"> hoặc kéo-thả.
 * @param {File} file
 * @returns {Promise<{video: object|null, problems: string[]}>}
 */
export async function readVideoFile(file) {
  if (!file) return { video: null, problems: ["Chưa chọn file"] };

  if (file.size > MAX_IMPORT_BYTES) {
    return {
      video: null,
      problems: [`File quá lớn (${Math.round(file.size / 1024)}KB), tối đa 2MB`],
    };
  }

  let text;
  try {
    text = await file.text();
  } catch (_) {
    return { video: null, problems: ["Không đọc được nội dung file"] };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { video: null, problems: [`File không phải JSON hợp lệ: ${err.message}`] };
  }

  return sanitizeVideo(parsed);
}

/**
 * Dựng object đúng schema để xuất ra file — chỉ phần `video`, bỏ hết metadata của phiên.
 */
export function buildExportPayload(video) {
  return {
    schemaVersion: SCHEMA_VERSION,
    videoId: video.videoId,
    provider: "youtube",
    url: video.url,
    thumbnail: video.thumbnail,
    durationSec: video.durationSec || 0,
    title: video.title || "",
    titleVi: video.titleVi || "",
    level: video.level || "",
    tags: video.tags || [],
    sourceChannel: video.sourceChannel || "",
    lineCount: (video.lines || []).length,
    lines: (video.lines || []).map((line) => ({
      id: line.id,
      start: line.start,
      end: line.end,
      jp: line.jp,
      kana: line.kana || "",
      romaji: line.romaji || "",
      vi: line.vi || "",
      tokens: line.tokens || [],
      note: line.note || "",
    })),
    visibility: "private",
    ownerUid: "",
    createdAt: video.createdAt || null,
    updatedAt: new Date().toISOString(),
  };
}

/** Tải file JSON về máy. */
export function downloadVideoJson(video) {
  const payload = buildExportPayload(video);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shadowing-${payload.videoId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url); // thiếu dòng này là rò bộ nhớ
  return payload;
}
