type VideoCardProps = {
  username: string;
  stream?: MediaStream;
  muted: boolean;
  cameraOff: boolean;
  isLocal?: boolean;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
};

function VideoCard({
  username,
  stream,
  muted,
  cameraOff,
  isLocal = false,
  localVideoRef,
}: VideoCardProps) {
  return (
    <div
      className={`video-card ${
        isLocal
          ? "local-video-card"
          : ""
      }`}
    >
      <div className="video-wrapper">
        {isLocal ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        ) : stream &&
          !cameraOff ? (
          <video
            autoPlay
            playsInline
            ref={(video) => {
              if (
                video &&
                video.srcObject !==
                  stream
              ) {
                video.srcObject =
                  stream;
              }
            }}
          />
        ) : (
          <div className="connecting">
            <div className="avatar">
              {username
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="connecting-name">
              {username}
            </div>

            {!stream ? (
              <>
                <div className="connecting-text">
                  Connecting...
                </div>

                <div className="loader"></div>
              </>
            ) : (
              <div className="connecting-text">
                Camera Off
              </div>
            )}
          </div>
        )}

        <div className="video-name">
          <span className="mic-status">
            {muted
              ? "🔇"
              : "🎤"}
          </span>

          {username}

          {isLocal && (
            <span className="you-label">
              You
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoCard;