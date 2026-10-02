import React, { useCallback, useEffect, useRef, useState } from "react";
import { MdContentCopy, MdCheck } from "react-icons/md";

import { useYouTubePlayer } from "../../hooks/useYouTubePlayer";
import { useActiveLine } from "../../hooks/useActiveLine";
import { usePcmRecorder } from "../../hooks/usePcmRecorder";
import { useTranscribe } from "../../hooks/useTranscribe";

import { YouTubeStage } from "./YouTubeStage";
import { SeekBar } from "./SeekBar";
import { SubtitleTrack } from "./SubtitleTrack";
import { ControlBar } from "./ControlBar";
import { RecordingPlayback } from "./RecordingPlayback";
import { TranscriptResult } from "./TranscriptResult";
import { PermissionBanner } from "./PermissionBanner";
import { TimecodeTool } from "./TimecodeTool";

const IS_DEV = process.env.NODE_ENV !== "production";
const EMPTY_LINES = [];

/**
 * Thẻ luyện tập: video + phụ đề + điều khiển + ghi âm + nhận dạng.
 * Tách khỏi trang để chế độ soạn bài cũng dùng lại được phần video/phụ đề.
 */
export const PracticeCard = ({ video, devTools }) => {
  const [showRomaji, setShowRomaji] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [copied, setCopied] = useState(false);

  // Trạng thái mute trước khi bấm thu, để khôi phục lại sau khi thu xong
  const muteBeforeRecordRef = useRef(null);

  const player = useYouTubePlayer(video ? video.videoId : null);
  const recorder = usePcmRecorder();
  const stt = useTranscribe();

  const lines = video && video.lines ? video.lines : EMPTY_LINES;
  const active = useActiveLine(lines, player.currentTime);

  const handleToggleRecord = useCallback(async () => {
    if (recorder.isRecording) {
      const result = await recorder.stop();

      if (muteBeforeRecordRef.current !== null) {
        player.setMuted(muteBeforeRecordRef.current);
        muteBeforeRecordRef.current = null;
      }

      if (result && active.line) {
        stt.transcribe({
          audioBase64: result.base64,
          sampleRate: result.sampleRate,
          videoId: video ? video.videoId : "",
          line: active.line,
          videoTimeAtStart: player.currentTime,
        });
      }
      return;
    }

    // Tắt tiếng video khi thu để tiếng loa không lọt vào mic
    muteBeforeRecordRef.current = player.isMuted;
    player.setMuted(true);

    stt.reset();
    recorder.reset();
    await recorder.start();
  }, [recorder, player, stt, active.line, video]);

  const handleRecordAgain = useCallback(() => {
    stt.reset();
    recorder.reset();
  }, [stt, recorder]);

  const handleRetryStt = useCallback(() => {
    if (recorder.result && active.line) {
      stt.transcribe({
        audioBase64: recorder.result.base64,
        sampleRate: recorder.result.sampleRate,
        videoId: video ? video.videoId : "",
        line: active.line,
        videoTimeAtStart: player.currentTime,
      });
    }
  }, [recorder.result, active.line, stt, video, player.currentTime]);

  const handleCopy = useCallback(async () => {
    if (!active.line) return;
    try {
      await navigator.clipboard.writeText(active.line.jp);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      /* clipboard bị chặn — bỏ qua, không làm phiền người dùng */
    }
  }, [active.line]);

  // Phím tắt: Space play/pause, ←/→ tua 5s, R ghi âm.
  // Bỏ qua khi đang gõ trong input để không cướp phím của form.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          player.togglePlay();
          break;
        case "ArrowLeft":
          event.preventDefault();
          player.seekBy(-5);
          break;
        case "ArrowRight":
          event.preventDefault();
          player.seekBy(5);
          break;
        case "r":
        case "R":
          event.preventDefault();
          handleToggleRecord();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player, handleToggleRecord]);

  if (!video) return null;

  return (
    <>
      <div className="sd-card">
        <button
          type="button"
          className="sd-copy-btn"
          onClick={handleCopy}
          aria-label="Copy câu phụ đề hiện tại"
          title="Copy câu phụ đề hiện tại"
        >
          {copied ? <MdCheck /> : <MdContentCopy />}
        </button>

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

        <SubtitleTrack
          line={active.line}
          isInside={active.isInside}
          progress={active.progress}
          showRomaji={showRomaji}
          showVi={showVi}
        />

        <div className="sd-sub-toggles">
          <button
            type="button"
            className={`sd-chip${showRomaji ? " is-on" : ""}`}
            onClick={() => setShowRomaji((v) => !v)}
            aria-pressed={showRomaji}
          >
            romaji
          </button>
          <button
            type="button"
            className={`sd-chip${showVi ? " is-on" : ""}`}
            onClick={() => setShowVi((v) => !v)}
            aria-pressed={showVi}
          >
            nghĩa
          </button>
        </div>

        <hr className="sd-divider" />

        <ControlBar
          isPlaying={player.isPlaying}
          isMuted={player.isMuted}
          currentTime={player.currentTime}
          duration={player.duration}
          recorderStatus={recorder.status}
          recordElapsed={recorder.elapsed}
          recordLevel={recorder.level}
          canRecord={recorder.canRecord}
          onTogglePlay={player.togglePlay}
          onToggleMute={player.toggleMute}
          onToggleRecord={handleToggleRecord}
          onSeekBy={player.seekBy}
          disabled={!player.ready}
        />

        <p className="sd-hint sd-hint--tip">
          Nên đeo tai nghe khi thu — tiếng video phát qua loa sẽ lọt vào micro và làm bản ghi bị méo.
        </p>

        <PermissionBanner
          status={recorder.status}
          message={recorder.errorMessage}
          onRetry={recorder.start}
        />

        {recorder.result && (
          <>
            <hr className="sd-divider" />
            <RecordingPlayback result={recorder.result} onDiscard={handleRecordAgain} />
            <TranscriptResult
              status={stt.status}
              transcript={stt.transcript}
              score={stt.score}
              errorMessage={stt.errorMessage}
              refText={active.line ? active.line.jp : ""}
              onRetry={handleRetryStt}
              onRecordAgain={handleRecordAgain}
            />
          </>
        )}
      </div>

      {IS_DEV && devTools !== false && (
        <TimecodeTool currentTime={player.currentTime} problems={null} />
      )}
    </>
  );
};
