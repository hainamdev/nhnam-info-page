import React from "react";

const LEVELS = ["", "N5", "N4", "N3", "N2", "N1"];

/**
 * Thông tin chung của bài. Không trường nào bắt buộc để bắt đầu gõ phụ đề —
 * bắt điền tiêu đề trước mới cho nhập câu là cản trở vô ích.
 */
export const LessonMetaForm = ({ video, onChange }) => {
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <div className="sd-meta">
      <p className="sd-blk-title">Thông tin bài</p>

      <div className="sd-meta-grid">
        <label>
          Tiêu đề JP
          <input
            type="text"
            lang="ja"
            value={video.title || ""}
            placeholder="日本の電車"
            onChange={(event) => set({ title: event.target.value })}
          />
        </label>

        <label>
          Tiêu đề VI
          <input
            type="text"
            value={video.titleVi || ""}
            placeholder="Tàu điện ở Nhật"
            onChange={(event) => set({ titleVi: event.target.value })}
          />
        </label>

        <label>
          Level
          <select value={video.level || ""} onChange={(event) => set({ level: event.target.value })}>
            {LEVELS.map((level) => (
              <option key={level || "none"} value={level}>
                {level || "— chưa chọn —"}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tags
          <input
            type="text"
            value={(video.tags || []).join(", ")}
            placeholder="daily-life, transport"
            onChange={(event) =>
              set({
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>
    </div>
  );
};
