import React, { useCallback, useEffect, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";

import "./style.css";

import { useShadowingSession } from "../../hooks/useShadowingSession";
import { shadowingVideos, validateVideo } from "../../data/shadowing";
import { downloadVideoJson } from "../../lib/sessionIO";

import { SessionChooser } from "../../components/shadowing/SessionChooser";
import { SessionBar } from "../../components/shadowing/SessionBar";
import { PracticeCard } from "../../components/shadowing/PracticeCard";
import { AuthorView } from "../../components/shadowing/AuthorView";
import { CloseSessionDialog } from "../../components/shadowing/author/CloseSessionDialog";

/**
 * Trang shadowing: chỉ điều phối theo phiên.
 * - chưa có phiên  -> màn chọn
 * - phiên import   -> thẻ luyện tập
 * - phiên author   -> giao diện soạn bài
 */
export const Shadowing = () => {
  const session = useShadowingSession();
  const [closing, setClosing] = useState(false);

  const video = session.session ? session.session.video : null;
  const mode = session.session ? session.session.mode : null;

  const handleExport = useCallback(() => {
    if (!video) return false;
    // Bai rong thi khong xuat — file khong co cau nao la vo nghia
    if (!video.lines || video.lines.length === 0) return false;
    const problems = validateVideo(video);
    if (problems.length) return false;
    downloadVideoJson(video);
    session.markExported();
    return true;
  }, [video, session]);

  const handleOpenSample = useCallback(() => {
    const sample = shadowingVideos[0];
    if (sample) session.startPractice(sample, "Bài mẫu");
  }, [session]);

  const handleCloseRequest = useCallback(() => setClosing(true), []);

  const handleExportThenClose = useCallback(() => {
    if (handleExport()) {
      setClosing(false);
      session.closeSession();
    }
  }, [handleExport, session]);

  const handleConfirmClose = useCallback(() => {
    setClosing(false);
    session.closeSession();
  }, [session]);

  // Cảnh báo khi đóng tab lúc còn thay đổi chưa xuất. Chỉ bật khi thực sự có gì để mất.
  const dirty = session.dirty;
  useEffect(() => {
    if (mode !== "author" || !dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mode, dirty]);

  return (
    <HelmetProvider>
      <section
        id="shadowing"
        className={`shadowing${session.status === "author" ? " is-author" : ""}`}
      >
        <Helmet>
          <meta charSet="utf-8" />
          <title>Shadowing 日本語</title>
          {/* Link ẩn để tự dùng — không cho vào index của máy tìm kiếm */}
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="sd-wrap">
          <header className="sd-head">
            <h1 className="sd-head__title">
              Shadowing <span lang="ja">日本語</span>
            </h1>
            {video && (video.title || video.titleVi) && (
              <p className="sd-head__meta">
                <span lang="ja">{video.title}</span>
                {video.titleVi ? `${video.title ? " · " : ""}${video.titleVi}` : ""}
                {video.level ? ` · ${video.level}` : ""}
              </p>
            )}
          </header>

          {session.status === "booting" && <p className="sd-hint">Đang mở…</p>}

          {session.status === "chooser" && (
            <SessionChooser
              notice={session.notice}
              onStartAuthor={session.startAuthor}
              onImport={session.startPractice}
              onOpenSample={handleOpenSample}
            />
          )}

          {session.session && video && (
            <>
              <SessionBar
                mode={mode}
                sourceName={session.session.sourceName}
                videoId={video.videoId}
                lineCount={session.lineCount}
                dirty={mode === "author" && dirty}
                onExport={handleExport}
                onClose={handleCloseRequest}
                onSwitchToAuthor={mode === "import" ? session.switchToAuthor : null}
              />

              {session.notice && <p className="sd-notice">{session.notice}</p>}
              {session.storageError && (
                <p className="sd-action-error" role="alert">
                  {session.storageError}
                </p>
              )}

              {session.status === "practice" && <PracticeCard video={video} />}

              {session.status === "author" && (
                <AuthorView
                  video={video}
                  autoFlags={session.session.autoFlags}
                  onChangeVideo={session.updateVideo}
                  onSetAutoFlags={session.setAutoFlags}
                />
              )}
            </>
          )}
        </div>

        {closing && (
          <CloseSessionDialog
            mode={mode}
            lineCount={session.lineCount}
            lastExportedAt={session.session ? session.session.lastExportedAt : null}
            onExportThenClose={handleExportThenClose}
            onClose={handleConfirmClose}
            onCancel={() => setClosing(false)}
          />
        )}
      </section>
    </HelmetProvider>
  );
};
