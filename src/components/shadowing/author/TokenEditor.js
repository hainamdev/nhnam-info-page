import React from "react";
import { joinTokens } from "../../../lib/lines";

/**
 * Sửa furigana của một câu.
 *
 * Luôn hiện dòng "Ghép lại … = jp" vì đây là bất biến dễ vỡ nhất của toàn bộ dữ liệu:
 * tokens ghép lại phải đúng bằng jp, lệch một ký tự là so khớp Speech-to-Text sai theo.
 */
export const TokenEditor = ({ line, onChange, onAutoFill, autoFillBusy, onClose }) => {
  const tokens = line.tokens && line.tokens.length ? line.tokens : [{ t: line.jp || "" }];
  const joined = joinTokens(tokens);
  const matches = joined === line.jp;

  const setToken = (index, patch) => {
    const next = tokens.map((token, i) => (i === index ? { ...token, ...patch } : token));
    onChange(next.filter((token) => token.t !== "" || next.length === 1));
  };

  const splitAt = (index) => {
    const token = tokens[index];
    if (!token || token.t.length < 2) return;
    const mid = Math.ceil(token.t.length / 2);
    const next = [...tokens];
    next.splice(index, 1, { t: token.t.slice(0, mid) }, { t: token.t.slice(mid) });
    onChange(next);
  };

  const mergeWithNext = (index) => {
    if (index >= tokens.length - 1) return;
    const next = [...tokens];
    const merged = { t: next[index].t + next[index + 1].t };
    next.splice(index, 2, merged);
    onChange(next);
  };

  return (
    <div className="sd-tok">
      <div className="sd-tok__head">
        <p className="sd-blk-title" style={{ margin: 0 }}>
          Câu {line.id} · furigana
        </p>
        <div className="sd-tok__head-actions">
          <button type="button" className="sd-ghost-btn" onClick={onAutoFill} disabled={autoFillBusy}>
            {autoFillBusy ? "Đang điền…" : "Tự điền lại"}
          </button>
          <button type="button" className="sd-ghost-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>

      <p className="sd-tok__preview" lang="ja">
        {tokens.map((token, index) =>
          token.r ? (
            <ruby key={index}>
              {token.t}
              <rt aria-hidden="true">{token.r}</rt>
            </ruby>
          ) : (
            <span key={index}>{token.t}</span>
          )
        )}
      </p>

      <div className="sd-tok__grid">
        {tokens.map((token, index) => (
          <div key={index} className={`sd-tok__cell${token.r ? " has-r" : ""}`}>
            <input
              type="text"
              lang="ja"
              value={token.t}
              aria-label={`Đoạn ${index + 1}`}
              onChange={(event) => setToken(index, { t: event.target.value })}
            />
            <input
              type="text"
              lang="ja"
              value={token.r || ""}
              placeholder="—"
              aria-label={`Furigana đoạn ${index + 1}`}
              onChange={(event) => {
                const value = event.target.value;
                setToken(index, value ? { r: value } : { r: undefined });
              }}
            />
            <div className="sd-tok__cell-ops">
              <button type="button" onClick={() => splitAt(index)} title="Tách đôi ô này">
                tách
              </button>
              {index < tokens.length - 1 && (
                <button type="button" onClick={() => mergeWithNext(index)} title="Gộp với ô sau">
                  gộp
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className={`sd-tok__check${matches ? " is-ok" : " is-bad"}`}>
        {matches ? (
          <>
            Ghép lại: <b lang="ja">{joined}</b> = jp ✓
          </>
        ) : (
          <>
            Ghép lại: <b lang="ja">{joined || "(rỗng)"}</b> ≠ jp <b lang="ja">{line.jp}</b>
          </>
        )}
      </p>
    </div>
  );
};
