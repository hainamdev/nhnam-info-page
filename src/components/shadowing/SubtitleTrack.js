import React from "react";

/**
 * Hiển thị câu phụ đề đang chạy, kanji có furigana phía trên bằng thẻ <ruby>.
 *
 * Về accessibility: screen reader sẽ đọc cả phần <rt> làm câu bị lặp
 * ("nihon nihon no densha densha wa"), nên <rt> được aria-hidden và phần đọc
 * cho máy đọc màn hình nằm ở <span class="sr-only"> riêng.
 */
export const SubtitleTrack = ({ line, isInside, progress, showRomaji, showVi }) => {
  if (!line) {
    return (
      <div className="sd-sub sd-sub--empty">
        <p className="sd-sub__jp">&nbsp;</p>
      </div>
    );
  }

  const tokens = Array.isArray(line.tokens) && line.tokens.length ? line.tokens : null;

  return (
    <div className={`sd-sub${isInside ? "" : " is-dim"}`}>
      <p className="sd-sub__jp" lang="ja" aria-hidden="true">
        {tokens
          ? tokens.map((token, index) =>
              token.r ? (
                <ruby key={index}>
                  {token.t}
                  <rt aria-hidden="true">{token.r}</rt>
                </ruby>
              ) : (
                <span key={index}>{token.t}</span>
              )
            )
          : line.jp}
      </p>

      {/* Nguồn đọc cho screen reader — polite để không ngắt lời liên tục */}
      <span className="sr-only" lang="ja" aria-live="polite">
        {line.jp}
      </span>

      {showRomaji && line.romaji && <p className="sd-sub__romaji">{line.romaji}</p>}
      {showVi && line.vi && (
        <p className="sd-sub__vi" lang="vi">
          {line.vi}
        </p>
      )}

      <div className="sd-sub__progress" aria-hidden="true">
        <i style={{ width: `${Math.round((progress || 0) * 100)}%` }} />
      </div>
    </div>
  );
};
