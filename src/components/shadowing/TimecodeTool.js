import React, { useState } from "react";

/**
 * Panel dò mốc thời gian — CHỈ HIỆN Ở DEV.
 *
 * Nhập mốc bằng tay là việc dễ sai nhất của tính năng này. Panel cho phép vừa xem video
 * vừa chốt start/end rồi copy ra object JS để dán thẳng vào src/data/shadowing.js
 */
export const TimecodeTool = ({ currentTime, problems }) => {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [copied, setCopied] = useState("");

  const round = (n) => Math.round(n * 100) / 100;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch (_) {
      setCopied("Không copy được");
    }
  };

  const snippet =
    start != null && end != null
      ? `{ id: 0, start: ${round(start)}, end: ${round(end)}, jp: "", kana: "", romaji: "", vi: "", tokens: [] },`
      : null;

  return (
    <div className="sd-devtool">
      <p className="sd-devtool__title">Công cụ dò mốc (chỉ hiện ở dev)</p>

      <div className="sd-devtool__row">
        <code>t = {round(currentTime)}</code>
        <button type="button" className="sd-ghost-btn" onClick={() => setStart(currentTime)}>
          Chốt start
        </button>
        <button type="button" className="sd-ghost-btn" onClick={() => setEnd(currentTime)}>
          Chốt end
        </button>
        <button
          type="button"
          className="sd-ghost-btn"
          onClick={() => copy(String(round(currentTime)), "mốc")}
        >
          Copy mốc
        </button>
      </div>

      {snippet && (
        <div className="sd-devtool__snippet">
          <code>{snippet}</code>
          <button type="button" className="sd-ghost-btn" onClick={() => copy(snippet, "snippet")}>
            Copy dòng
          </button>
        </div>
      )}

      {copied && <p className="sd-devtool__ok">Đã copy {copied}</p>}

      {problems && problems.length > 0 && (
        <div className="sd-devtool__problems">
          <p>Data có {problems.length} vấn đề:</p>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
