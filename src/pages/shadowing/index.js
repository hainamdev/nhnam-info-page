import React, { useCallback, useEffect, useState } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { MdLightMode, MdDarkMode } from "react-icons/md";

import "./style.css";

import { useShadowingSession } from "../../hooks/useShadowingSession";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { useShadowingTheme } from "../../hooks/useShadowingTheme";
import { shadowingVideos, validateVideo } from "../../data/shadowing";
import { downloadVideoJson } from "../../lib/sessionIO";
import { saveVideo, loadVideo } from "../../lib/videoStore";

import { SessionChooser } from "../../components/shadowing/SessionChooser";
import { SessionBar } from "../../components/shadowing/SessionBar";
import { PracticeCard } from "../../components/shadowing/PracticeCard";
import { AuthorView } from "../../components/shadowing/AuthorView";
import { CloseSessionDialog } from "../../components/shadowing/author/CloseSessionDialog";
import { AuthChip } from "../../components/shadowing/AuthChip";
import { VideoGallery } from "../../components/shadowing/VideoGallery";

/**
 * Trang shadowing: chỉ điều phối theo phiên.
 * - chưa có phiên  -> màn chọn
 * - phiên import   -> thẻ luyện tập
 * - phiên author   -> giao diện soạn bài
 */
export const Shadowing = () => {
  const session = useShadowingSession();
  const auth = useFirebaseAuth();
  const theme = useShadowingTheme();
  const [closing, setClosing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);

  // Hai tính năng Firebase chỉ dùng được khi đã cấu hình VÀ đã đăng nhập
  const firebaseReady = auth.isAvailable && auth.isSignedIn;

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

  const handleSaveToFirebase = useCallback(async () => {
    if (!video) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await saveVideo(video);
      session.markExported(); // đã nằm ở nơi an toàn, không còn là thay đổi chưa lưu
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err && err.message ? err.message : "Lưu lên Firebase thất bại.");
    }
  }, [video, session]);

  const handlePickFromFirebase = useCallback(
    async (videoId) => {
      try {
        const { video: loaded, problems } = await loadVideo(videoId);
        if (!loaded) {
          setSaveError((problems && problems[0]) || "Không mở được bài học này.");
          return;
        }
        setBrowsing(false);
        setSaveError(null);
        session.startPractice(loaded, `Firebase · ${videoId}`);
      } catch (err) {
        setSaveError(err && err.message ? err.message : "Không mở được bài học này.");
      }
    },
    [session]
  );

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
        className={[
          "shadowing",
          session.status === "author" ? "is-author" : "",
          theme.isLight ? "is-light" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Helmet>
          <meta charSet="utf-8" />
          <title>Shadowing 日本語</title>
          {/* Link ẩn để tự dùng — không cho vào index của máy tìm kiếm */}
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="sd-wrap">
          <header className="sd-head">
            <div className="sd-head__row">
              <h1 className="sd-head__title">
                Shadowing <span lang="ja">日本語</span>
              </h1>
              <button
                type="button"
                className="sd-theme-btn"
                onClick={theme.toggle}
                aria-label={theme.isLight ? "Chuyển sang nền tối" : "Chuyển sang nền sáng"}
                title={theme.isLight ? "Chuyển sang nền tối" : "Chuyển sang nền sáng"}
              >
                {theme.isLight ? <MdDarkMode /> : <MdLightMode />}
              </button>
            </div>
            {video && (video.title || video.titleVi) && (
              <p className="sd-head__meta">
                <span lang="ja">{video.title}</span>
                {video.titleVi ? `${video.title ? " · " : ""}${video.titleVi}` : ""}
                {video.level ? ` · ${video.level}` : ""}
              </p>
            )}
          </header>

          <AuthChip auth={auth} />

          {session.status === "booting" && <p className="sd-hint">Đang mở…</p>}

          {session.status === "chooser" && saveError && (
            <p className="sd-action-error" role="alert">
              {saveError}
            </p>
          )}

          {session.status === "chooser" && browsing && (
            <VideoGallery onPick={handlePickFromFirebase} onBack={() => setBrowsing(false)} />
          )}

          {session.status === "chooser" && !browsing && (
            <SessionChooser
              notice={session.notice}
              onStartAuthor={session.startAuthor}
              onImport={session.startPractice}
              onOpenSample={handleOpenSample}
              onOpenFirebase={() => setBrowsing(true)}
              firebaseReady={firebaseReady}
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
                onSaveToFirebase={handleSaveToFirebase}
                firebaseReady={firebaseReady}
                saveStatus={saveStatus}
                saveError={saveError}
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
