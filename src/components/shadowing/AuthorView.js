import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MdPlayArrow, MdPause, MdReplay5, MdForward5, MdBolt } from "react-icons/md";

import { useYouTubePlayer } from "../../hooks/useYouTubePlayer";
import { useActiveLine } from "../../hooks/useActiveLine";
import { useAutoFill } from "../../hooks/useAutoFill";
import { validateVideo } from "../../data/shadowing";
import { formatTime } from "../../lib/audio";
import { addLineAtTime, closeOpenLineAtTime, findOpenLine, removeLine, updateLine } from "../../lib/lines";

import { YouTubeStage } from "./YouTubeStage";
import { SeekBar } from "./SeekBar";
import { LessonMetaForm } from "./author/LessonMetaForm";
import { LineTable } from "./author/LineTable";
import { ValidationPanel } from "./author/ValidationPanel";

const EMPTY_LINES = [];

/**
 * Chế độ soạn bài: xem video, bấm thêm câu theo thời điểm đang phát, gõ phụ đề,
 * tự điền phần còn lại rồi xuất JSON.
 */
export const AuthorView = ({ video, onChangeVideo, onSetAutoFlags, autoFlags }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [autoFillBusyId, setAutoFillBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const player = useYouTubePlayer(video.videoId);
  const lines = video.lines || EMPTY_LINES;
  const active = useActiveLine(lines, player.currentTime);
  const autoFill = useAutoFill();

  // Thời lượng chỉ biết được sau khi player sẵn sàng — lưu lại để xuất ra JSON
  useEffect(() => {
    if (player.duration && Math.abs((video.durationSec || 0) - player.duration) >= 1) {
      onChangeVideo((prev) => ({ ...prev, durationSec: Math.round(player.duration) }));
    }
  }, [player.duration, video.durationSec, onChangeVideo]);

  const problems = useMemo(() => validateVideo(video), [video]);
  const canExport = problems.length === 0 && lines.length > 0;
  const openLine = findOpenLine(lines);

  const patchLine = useCallback(
    (id, patch) => {
      // Người gõ vào ô nào thì ô đó thôi không còn là "máy điền"
      const touched = {};
      for (const key of Object.keys(patch)) touched[key] = false;
      onSetAutoFlags(id, touched);

      onChangeVideo((prev) => ({ ...prev, lines: updateLine(prev.lines, id, patch) }));
    },
    [onChangeVideo, onSetAutoFlags]
  );

  const handleAddLine = useCallback(() => {
    const result = addLineAtTime(lines, player.currentTime);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setActionError(null);
    onChangeVideo((prev) => ({ ...prev, lines: result.lines }));
  }, [lines, player.currentTime, onChangeVideo]);

  const handleCloseLine = useCallback(() => {
    const result = closeOpenLineAtTime(lines, player.currentTime);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setActionError(null);
    onChangeVideo((prev) => ({ ...prev, lines: result.lines }));
  }, [lines, player.currentTime, onChangeVideo]);

  const handleRemoveLine = useCallback(
    (id) => {
      if (expandedId === id) setExpandedId(null);
      onChangeVideo((prev) => ({ ...prev, lines: removeLine(prev.lines, id) }));
    },
    [expandedId, onChangeVideo]
  );

  const applyFilled = useCallback(
    (lineId, filled) => {
      onChangeVideo((prev) => ({
        ...prev,
        lines: updateLine(prev.lines, lineId, {
          kana: filled.kana,
          romaji: filled.romaji,
          vi: filled.vi,
          tokens: filled.tokens,
        }),
      }));
      onSetAutoFlags(lineId, { kana: true, romaji: true, vi: true, tokens: true });
    },
    [onChangeVideo, onSetAutoFlags]
  );

  const handleAutoFillLine = useCallback(
    async (line) => {
      setAutoFillBusyId(line.id);
      await autoFill.fill([{ id: line.id, jp: line.jp }], applyFilled);
      setAutoFillBusyId(null);
    },
    [autoFill, applyFilled]
  );

  /** Chỉ điền những ô còn trống HOẶC do máy điền trước đó — không đụng thứ đã sửa tay */
  const handleAutoFillEmpty = useCallback(async () => {
    const targets = lines.filter((line) => {
      if (!line.jp || !line.jp.trim()) return false;
      const flags = (autoFlags || {})[String(line.id)] || {};
      const missing = !line.kana || !line.vi || !(line.tokens && line.tokens.length);
      const onlyAuto = flags.kana !== false && flags.vi !== false && flags.tokens !== false;
      return missing && onlyAuto;
    });

    if (!targets.length) {
      setActionError("Không còn ô trống nào để điền (ô bạn đã sửa tay được giữ nguyên).");
      return;
    }
    setActionError(null);
    await autoFill.fill(targets.map((l) => ({ id: l.id, jp: l.jp })), applyFilled);
  }, [lines, autoFlags, autoFill, applyFilled]);

  // Enter = thêm câu. Không dùng Space vì phần luyện tập đã gán cho play/pause.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        event.preventDefault();
        handleAddLine();
      } else if (event.key === " ") {
        event.preventDefault();
        player.togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        player.seekBy(-5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        player.seekBy(5);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAddLine, player]);

  return (
    <div className="sd-card sd-card--wide">
      <div className="sd-author-top">
        <div className="sd-author-stage">
          <YouTubeStage
            hostRef={player.hostRef}
            ready={player.ready}
            error={player.error}
            videoUrl={video.url}
          />

          <SeekBar
            currentTime={player.currentTime}
            duration={player.duration}
            onSeek={player.seekTo}
            disabled={!player.ready}
            lines={lines}
          />
        </div>

        <div className="sd-author-prev">
          <p className="sd-blk-title">Câu đang chạy</p>
          <p className="sd-author-prev__jp" lang="ja">
            {active.line && active.line.tokens && active.line.tokens.length
              ? active.line.tokens.map((token, index) =>
                  token.r ? (
                    <ruby key={index}>
                      {token.t}
                      <rt aria-hidden="true">{token.r}</rt>
                    </ruby>
                  ) : (
                    <span key={index}>{token.t}</span>
                  )
                )
              : (active.line && active.line.jp) || "—"}
          </p>

          <div className="sd-transport sd-transport--author">
            <button
              type="button"
              className="sd-tbtn"
              onClick={() => player.seekBy(-5)}
              disabled={!player.ready}
              aria-label="Lùi 5 giây"
            >
              <MdReplay5 />
            </button>
            <button
              type="button"
              className="sd-tbtn sd-tbtn--main"
              onClick={player.togglePlay}
              disabled={!player.ready}
              aria-label={player.isPlaying ? "Tạm dừng" : "Phát"}
            >
              {player.isPlaying ? <MdPause /> : <MdPlayArrow />}
            </button>
            <button
              type="button"
              className="sd-tbtn"
              onClick={() => player.seekBy(5)}
              disabled={!player.ready}
              aria-label="Tới 5 giây"
            >
              <MdForward5 />
            </button>
          </div>
        </div>
      </div>

      <hr className="sd-divider sd-divider--full" />

      <LessonMetaForm video={video} onChange={onChangeVideo} />

      <div className="sd-lines-head">
        <p className="sd-blk-title" style={{ margin: 0 }}>
          Các câu ({lines.length})
        </p>
        <div className="sd-lines-actions">
          <button
            type="button"
            className="sd-primary-btn"
            onClick={handleAddLine}
            disabled={!player.ready}
          >
            + Thêm câu tại {formatTime(player.currentTime)}
          </button>
          <button
            type="button"
            className="sd-ghost-btn"
            onClick={handleCloseLine}
            disabled={!openLine}
            title={openLine ? "Chốt end cho câu đang mở" : "Không có câu nào đang mở"}
          >
            Chốt end
          </button>
          <button
            type="button"
            className="sd-ghost-btn"
            onClick={handleAutoFillEmpty}
            disabled={autoFill.status === "loading" || !autoFill.isAvailable}
            title={
              autoFill.isAvailable
                ? "Điền kana / romaji / nghĩa / furigana cho các ô còn trống"
                : "Cần cấu hình Firebase và deploy Cloud Function enrichShadowingLines"
            }
          >
            <MdBolt /> Tự điền ô trống
          </button>
        </div>
      </div>

      {actionError && (
        <p className="sd-action-error" role="alert">
          {actionError}
        </p>
      )}

      {autoFill.status === "loading" && (
        <div className="sd-stt__loading">
          <span className="sd-dots">
            <i />
            <i />
            <i />
          </span>
          Đang tự điền {autoFill.progress.done}/{autoFill.progress.total} câu…
        </div>
      )}

      {autoFill.status === "error" && autoFill.errorMessage && (
        <p className="sd-action-error" role="alert">
          {autoFill.errorMessage}
        </p>
      )}

      {autoFill.status === "unavailable" && (
        <p className="sd-hint">
          Tự điền chưa bật. Cần cấu hình Firebase và deploy Cloud Function{" "}
          <code>enrichShadowingLines</code> — xem <code>docs/shadowing-feature.md</code> §B4.5. Gõ tay
          vẫn dùng bình thường.
        </p>
      )}

      {autoFill.status === "done" && autoFill.report && (
        <div className="sd-fill-res">
          <p>
            <b className="sd-ok-t">{autoFill.report.ok} câu</b> đã điền đủ.
          </p>
          {autoFill.report.needsReview.length > 0 && (
            <>
              <p>
                <b className="sd-warn-t">{autoFill.report.needsReview.length} câu</b> cần xem lại:
              </p>
              <ul>
                {autoFill.report.needsReview.map((item) => (
                  <li key={item.id}>
                    câu {item.id} — {item.problems.join("; ")}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="sd-caveat">
            Kết quả tự điền là <b>bản nháp để rà</b>. Cách đọc kanji phụ thuộc ngữ cảnh và tên riêng
            thì máy nào cũng hay sai — hãy kiểm lại trước khi xuất.
          </p>
        </div>
      )}

      <LineTable
        lines={lines}
        activeLineId={active.line ? active.line.id : null}
        expandedId={expandedId}
        autoFillBusyId={autoFillBusyId}
        onPatchLine={patchLine}
        onRemoveLine={handleRemoveLine}
        onSeekTo={player.seekTo}
        onAutoFillLine={handleAutoFillLine}
        onToggleExpand={setExpandedId}
      />

      <ValidationPanel problems={problems} lineCount={lines.length} />

      {!canExport && lines.length > 0 && (
        <p className="sd-hint">Sửa hết các vấn đề ở trên là xuất JSON được.</p>
      )}
    </div>
  );
};
