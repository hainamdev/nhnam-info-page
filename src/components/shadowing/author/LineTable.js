import React from "react";
import { MdBolt, MdExpandMore, MdMyLocation, MdDeleteOutline } from "react-icons/md";
import { isOpenLine } from "../../../lib/lines";
import { TokenEditor } from "./TokenEditor";

const fmt = (value) => (typeof value === "number" ? value.toFixed(2) : "…");

/** Ô nhập số cho start/end — giữ chuỗi thô khi đang gõ để không chặn "11." */
const NumCell = ({ value, onCommit, invalid, placeholder }) => {
  const [draft, setDraft] = React.useState(null);
  const shown = draft !== null ? draft : typeof value === "number" ? value.toFixed(2) : "";

  return (
    <input
      type="text"
      inputMode="decimal"
      className={`sd-num${invalid ? " is-invalid" : ""}`}
      value={shown}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === null) return;
        const parsed = draft.trim() === "" ? null : Number(draft);
        onCommit(Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.target.blur();
      }}
    />
  );
};

const RowOps = ({ onAutoFill, onToggleTokens, onSeek, onRemove, busy, expanded }) => (
  <div className="sd-row-ops">
    <button type="button" onClick={onAutoFill} disabled={busy} title="Tự điền dòng này" aria-label="Tự điền dòng này">
      <MdBolt />
    </button>
    <button
      type="button"
      onClick={onToggleTokens}
      title="Sửa furigana"
      aria-label="Sửa furigana"
      aria-expanded={expanded}
      className={expanded ? "is-on" : undefined}
    >
      <MdExpandMore />
    </button>
    <button type="button" onClick={onSeek} title="Tua video tới câu này" aria-label="Tua video tới câu này">
      <MdMyLocation />
    </button>
    <button type="button" onClick={onRemove} title="Xoá câu" aria-label="Xoá câu" className="is-danger">
      <MdDeleteOutline />
    </button>
  </div>
);

/**
 * Bảng nhập các câu. Dưới 768px chuyển sang danh sách thẻ vì bảng 7 cột không thể
 * bóp vừa màn hình hẹp mà vẫn dùng được.
 */
export const LineTable = ({
  lines,
  activeLineId,
  expandedId,
  autoFillBusyId,
  onPatchLine,
  onRemoveLine,
  onSeekTo,
  onAutoFillLine,
  onToggleExpand,
}) => {
  if (!lines.length) {
    return (
      <p className="sd-empty">
        Chưa có câu nào. Phát video tới lúc câu đầu tiên bắt đầu rồi bấm <b>“+ Thêm câu”</b>.
      </p>
    );
  }

  const renderTokenEditor = (line) => (
    <TokenEditor
      line={line}
      onChange={(tokens) => onPatchLine(line.id, { tokens })}
      onAutoFill={() => onAutoFillLine(line)}
      autoFillBusy={autoFillBusyId === line.id}
      onClose={() => onToggleExpand(null)}
    />
  );

  return (
    <>
      {/* Bảng — màn rộng */}
      <div className="sd-table-wrap">
        <table className="sd-ltable">
          <thead>
            <tr>
              <th>#</th>
              <th>start</th>
              <th>end</th>
              <th>jp</th>
              <th>kana</th>
              <th>romaji</th>
              <th>vi</th>
              <th aria-label="thao tác" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const open = isOpenLine(line);
              const next = lines[index + 1];
              const badRange = typeof line.end === "number" && line.end <= line.start;
              const overlaps = next && typeof line.end === "number" && line.end > next.start;

              return (
                <React.Fragment key={line.id}>
                  <tr
                    className={[
                      line.id === activeLineId ? "is-current" : "",
                      open ? "is-open" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <NumCell
                        value={line.start}
                        invalid={badRange}
                        onCommit={(v) => onPatchLine(line.id, { start: v === null ? 0 : v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={line.end}
                        placeholder="…"
                        invalid={badRange || overlaps}
                        onCommit={(v) => onPatchLine(line.id, { end: v })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        lang="ja"
                        className="sd-jp-input"
                        value={line.jp}
                        placeholder="Gõ câu tiếng Nhật…"
                        onChange={(event) => onPatchLine(line.id, { jp: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        lang="ja"
                        value={line.kana || ""}
                        onChange={(event) => onPatchLine(line.id, { kana: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.romaji || ""}
                        onChange={(event) => onPatchLine(line.id, { romaji: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.vi || ""}
                        onChange={(event) => onPatchLine(line.id, { vi: event.target.value })}
                      />
                    </td>
                    <td>
                      <RowOps
                        busy={autoFillBusyId === line.id}
                        expanded={expandedId === line.id}
                        onAutoFill={() => onAutoFillLine(line)}
                        onToggleTokens={() => onToggleExpand(expandedId === line.id ? null : line.id)}
                        onSeek={() => onSeekTo(line.start)}
                        onRemove={() => onRemoveLine(line.id)}
                      />
                    </td>
                  </tr>

                  {expandedId === line.id && (
                    <tr className="sd-tok-row">
                      <td colSpan={8}>{renderTokenEditor(line)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Danh sách thẻ — màn hẹp */}
      <div className="sd-lcards">
        {lines.map((line, index) => {
          const open = isOpenLine(line);
          return (
            <div
              key={line.id}
              className={[
                "sd-lcard",
                line.id === activeLineId ? "is-current" : "",
                open ? "is-open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="sd-lcard__head">
                <b>Câu {index + 1}</b>
                <RowOps
                  busy={autoFillBusyId === line.id}
                  expanded={expandedId === line.id}
                  onAutoFill={() => onAutoFillLine(line)}
                  onToggleTokens={() => onToggleExpand(expandedId === line.id ? null : line.id)}
                  onSeek={() => onSeekTo(line.start)}
                  onRemove={() => onRemoveLine(line.id)}
                />
              </div>

              <p className="sd-lcard__time">
                {fmt(line.start)} → <span className={open ? "is-open" : undefined}>{fmt(line.end)}</span>
              </p>

              <input
                type="text"
                lang="ja"
                className="sd-jp-input"
                value={line.jp}
                placeholder="Gõ câu tiếng Nhật…"
                onChange={(event) => onPatchLine(line.id, { jp: event.target.value })}
              />
              <input
                type="text"
                lang="ja"
                placeholder="kana"
                value={line.kana || ""}
                onChange={(event) => onPatchLine(line.id, { kana: event.target.value })}
              />
              <input
                type="text"
                placeholder="nghĩa tiếng Việt"
                value={line.vi || ""}
                onChange={(event) => onPatchLine(line.id, { vi: event.target.value })}
              />

              {expandedId === line.id && renderTokenEditor(line)}
            </div>
          );
        })}
      </div>
    </>
  );
};
