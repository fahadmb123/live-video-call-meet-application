import {
  useEffect,
  useRef,
} from "react";

import type { RemoteUser } from "../../types/webrtc";

import VideoCard from "./VideoCard";
import Controls from "./Controls";

type MeetingPageProps = {
  roomId: string;
  username: string;

  localStream: MediaStream | null;

  remoteUsers: Map<
    string,
    RemoteUser
  >;

  muted: boolean;
  cameraOff: boolean;

  onMute: () => void;
  onCamera: () => void;
  onLeave: () => void;
};

function MeetingPage({
  roomId,
  username,
  localStream,
  remoteUsers,
  muted,
  cameraOff,
  onMute,
  onCamera,
  onLeave,
}: MeetingPageProps) {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (
      videoRef.current &&
      localStream
    ) {
      videoRef.current.srcObject =
        localStream;
    }
  }, [localStream]);

  return (
    <div className="meeting-page">
      <header className="meeting-header">
        <div className="brand">
          <div className="logo-icon">
            M
          </div>

          <span>
            MeetSpace
          </span>
        </div>

        <div className="room-info">
          <span className="room-label">
            Room
          </span>

          <span className="room-id">
            {roomId}
          </span>
        </div>

        <div className="participant-count">
          <span className="status-dot"></span>

          {remoteUsers.size + 1}{" "}
          participant
          {remoteUsers.size + 1 !== 1
            ? "s"
            : ""}
        </div>
      </header>

      <main className="meeting-content">
        <section
          className={`video-grid video-grid-${remoteUsers.size + 1}`}
        >
      

          <VideoCard
            username={username}
            muted={muted}
            cameraOff={cameraOff}
            isLocal
            localVideoRef={videoRef}
          />


          {Array.from(
            remoteUsers.entries()
          ).map(
            ([userId, user]) => (
              <VideoCard
                key={userId}
                username={
                  user.username
                }
                stream={user.stream}
                muted={user.muted}
                cameraOff={
                  user.cameraOff
                }
              />
            )
          )}
        </section>

        <Controls
          muted={muted}
          cameraOff={cameraOff}
          onMute={onMute}
          onCamera={onCamera}
          onLeave={onLeave}
        />
      </main>
    </div>
  );
}

export default MeetingPage;