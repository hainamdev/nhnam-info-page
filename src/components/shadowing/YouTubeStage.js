import React from "react";

/**
 * Khung chứa iframe YouTube.
 *
 * `hostRef` do useYouTubePlayer cấp — hook tự tạo node con bên trong rồi giao cho
 * YT.Player, nên React không được render children vào đây.
 */
export const YouTubeStage = ({ hostRef, ready, error, videoUrl }) => {
  return (
    <div className={`sd-stage${ready ? " is-ready" : ""}`}>
      <div className="sd-stage__host" ref={hostRef} />

      {!ready && !error && (
        <div className="sd-stage__overlay" aria-hidden="true">
          VIDEO
        </div>
      )}

      {error && (
        <div className="sd-stage__overlay sd-stage__overlay--error" role="alert">
          <p>Không phát được video này.</p>
          <a href={videoUrl} target="_blank" rel="noreferrer noopener">
            Mở trên YouTube
          </a>
        </div>
      )}
    </div>
  );
};
