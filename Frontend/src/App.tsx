import { useEffect, useRef, useState } from "react";
import socket from "./ws/socket";
import "./App.css"
type PeerMap = Map<string, RTCPeerConnection>;

type RemoteUser = {
  username: string;
  stream?: MediaStream;
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const peersRef = useRef<PeerMap>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const pendingCandidatesRef = useRef<
    Map<string, RTCIceCandidate[]>
  >(new Map());

  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  const [joined, setJoined] = useState(false);
  const [myUserId, setMyUserId] = useState("");

  const [remoteUsers, setRemoteUsers] = useState<
    Map<string, RemoteUser>
  >(new Map());

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const sendMessage = (data: object) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  const createPeerConnection = (userId: string) => {
    const existingPeer = peersRef.current.get(userId);

    if (existingPeer) {
      return existingPeer;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peersRef.current.set(userId, peerConnection);

    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.ontrack = (event) => {
      console.log("REMOTE TRACK RECEIVED:", userId);

      const stream = event.streams[0];

      if (!stream) {
        console.log("No remote stream received");
        return;
      }

      setRemoteUsers((previous) => {
        const updated = new Map(previous);

        const existingUser = updated.get(userId);

        if (existingUser) {
          updated.set(userId, {
            ...existingUser,
            stream,
          });
        }

        return updated;
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;

      console.log("Sending ICE candidate to:", userId);

      sendMessage({
        type: "ice-candidate",
        candidate: event.candidate,
        target: userId,
      });
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        `ICE state ${userId}:`,
        peerConnection.iceConnectionState
      );
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection state ${userId}:`,
        peerConnection.connectionState
      );

      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed"
      ) {
        removePeer(userId);
      }
    };

    return peerConnection;
  };

  const removePeer = (userId: string) => {
    const peerConnection = peersRef.current.get(userId);

    if (peerConnection) {
      peerConnection.close();
      peersRef.current.delete(userId);
    }

    pendingCandidatesRef.current.delete(userId);

    setRemoteUsers((previous) => {
      const updated = new Map(previous);
      updated.delete(userId);
      return updated;
    });
  };

  const createOffer = async (userId: string) => {
    try {
      console.log("Creating offer for:", userId);

      const peerConnection = createPeerConnection(userId);

      const offer = await peerConnection.createOffer();

      await peerConnection.setLocalDescription(offer);

      console.log("Sending offer to:", userId);

      sendMessage({
        type: "offer",
        offer: peerConnection.localDescription,
        target: userId,
      });
    } catch (error) {
      console.error("Offer error:", error);
    }
  };

  const addPendingCandidates = async (
    userId: string,
    peerConnection: RTCPeerConnection
  ) => {
    const candidates =
      pendingCandidatesRef.current.get(userId);

    if (!candidates) return;

    console.log(
      `Adding ${candidates.length} queued ICE candidates from ${userId}`
    );

    for (const candidate of candidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error(
          "Queued ICE candidate error:",
          error
        );
      }
    }

    pendingCandidatesRef.current.delete(userId);
  };

  const joinRoom = async () => {
    if (!roomId.trim()) return;
    if (!username.trim()) return;

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;

      setJoined(true);

      sendMessage({
        type: "join-room",
        roomId: roomId.trim(),
        username: username.trim(),
      });

      console.log(
        `Joining room ${roomId.trim()} as ${username.trim()}`
      );
    } catch (error) {
      console.error(
        "Camera/microphone error:",
        error
      );
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];

    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;

    setMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;

    setCameraOff(!videoTrack.enabled);
  };

  const leaveRoom = () => {
    sendMessage({
      type: "leave-room",
    });

    localStreamRef.current?.getTracks().forEach(
      (track) => {
        track.stop();
      }
    );

    peersRef.current.forEach((peer) => {
      peer.close();
    });

    peersRef.current.clear();

    pendingCandidatesRef.current.clear();

    localStreamRef.current = null;

    setRemoteUsers(new Map());
    setJoined(false);
    setMyUserId("");
  };

  useEffect(() => {
    if (
      joined &&
      videoRef.current &&
      localStreamRef.current
    ) {
      videoRef.current.srcObject =
        localStreamRef.current;
    }
  }, [joined]);

  useEffect(() => {
    const handleMessage = async (
      event: MessageEvent
    ) => {
      try {
        const message = JSON.parse(event.data);

        console.log(
          "SIGNAL:",
          message.type,
          message
        );

        if (message.type === "room-joined") {
          console.log(
            "ROOM JOINED:",
            message.username,
            message.userId
          );

          setMyUserId(message.userId);

          const users = message.users || [];

          console.log(
            "EXISTING USERS:",
            users
          );

          for (const user of users) {
            if (user.userId === message.userId) {
              continue;
            }

            setRemoteUsers((previous) => {
              const updated = new Map(previous);

              updated.set(user.userId, {
                username: user.username,
              });

              return updated;
            });

            await createOffer(user.userId);
          }

          return;
        }

        if (message.type === "user-joined") {
          console.log(
            `${message.username} joined`
          );

          setRemoteUsers((previous) => {
            const updated = new Map(previous);

            updated.set(message.userId, {
              username: message.username,
            });

            return updated;
          });

          return;
        }

        if (message.type === "offer") {
          const userId = message.from;

          console.log(
            "OFFER RECEIVED FROM:",
            userId
          );

          const peerConnection =
            createPeerConnection(userId);

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              message.offer
            )
          );

          console.log(
            "Remote offer description set:",
            userId
          );

          await addPendingCandidates(
            userId,
            peerConnection
          );

          const answer =
            await peerConnection.createAnswer();

          await peerConnection.setLocalDescription(
            answer
          );

          console.log(
            "SENDING ANSWER TO:",
            userId
          );

          sendMessage({
            type: "answer",
            answer: peerConnection.localDescription,
            target: userId,
          });

          return;
        }

        if (message.type === "answer") {
          const userId = message.from;

          console.log(
            "ANSWER RECEIVED FROM:",
            userId
          );

          const peerConnection =
            peersRef.current.get(userId);

          if (!peerConnection) {
            console.log(
              "No peer for answer:",
              userId
            );
            return;
          }

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              message.answer
            )
          );

          console.log(
            "Remote answer description set:",
            userId
          );

          await addPendingCandidates(
            userId,
            peerConnection
          );

          return;
        }

        if (message.type === "ice-candidate") {
          const userId = message.from;

          console.log(
            "ICE RECEIVED FROM:",
            userId
          );

          const candidate =
            new RTCIceCandidate(
              message.candidate
            );

          const peerConnection =
            peersRef.current.get(userId);

          if (!peerConnection) {
            let candidates =
              pendingCandidatesRef.current.get(
                userId
              );

            if (!candidates) {
              candidates = [];

              pendingCandidatesRef.current.set(
                userId,
                candidates
              );
            }

            candidates.push(candidate);

            console.log(
              "ICE queued:",
              userId
            );

            return;
          }

          if (
            peerConnection.remoteDescription
          ) {
            try {
              await peerConnection.addIceCandidate(
                candidate
              );

              console.log(
                "ICE candidate added:",
                userId
              );
            } catch (error) {
              console.error(
                "ICE candidate error:",
                error
              );
            }
          } else {
            let candidates =
              pendingCandidatesRef.current.get(
                userId
              );

            if (!candidates) {
              candidates = [];

              pendingCandidatesRef.current.set(
                userId,
                candidates
              );
            }

            candidates.push(candidate);

            console.log(
              "ICE queued because remote description is missing:",
              userId
            );
          }

          return;
        }

        if (message.type === "user-left") {
          console.log(
            "USER LEFT:",
            message.userId
          );

          removePeer(message.userId);

          return;
        }
      } catch (error) {
        console.error(
          "WebSocket message error:",
          error
        );
      }
    };

    socket.onmessage = handleMessage;

    return () => {
      socket.onmessage = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(
        (track) => {
          track.stop();
        }
      );

      peersRef.current.forEach((peer) => {
        peer.close();
      });

      peersRef.current.clear();
    };
  }, []);

  return (
    <div className="app">

      {!joined && (
        <div className="join-page">

          <div className="join-card">

            <div className="logo">
              <div className="logo-icon">M</div>
              <span>MeetSpace</span>
            </div>

            <h1>Join a Meeting</h1>

            <p className="join-description">
              Connect with your team and start a video conversation.
            </p>

            <div className="form-group">
              <label>Your Name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Room ID</label>

              <input
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(event) =>
                  setRoomId(event.target.value)
                }
              />
            </div>

            <button
              className="join-button"
              onClick={joinRoom}
            >
              Join Room
            </button>

            <p className="join-footer">
              Enter the same room ID to meet with others.
            </p>

          </div>

        </div>
      )}

      {joined && (
        <div className="meeting-page">

          <header className="meeting-header">

            <div className="brand">
              <div className="logo-icon">M</div>

              <span>MeetSpace</span>
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

              {remoteUsers.size + 1} participant
              {remoteUsers.size + 1 !== 1 ? "s" : ""}
            </div>

          </header>


          <main className="meeting-content">

            <section className="video-grid">

              <div className="video-card local-video-card">

                <div className="video-wrapper">

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                  />

                  <div className="video-name">
                    <span className="mic-status">
                      {muted ? "🔇" : "🎤"}
                    </span>

                    {username}
                    <span className="you-label">
                      You
                    </span>
                  </div>

                </div>

              </div>


              {Array.from(remoteUsers.entries()).map(
                ([userId, user]) => {

                  const stream = user.stream;

                  return (
                    <div
                      className="video-card"
                      key={userId}
                    >

                      <div className="video-wrapper">

                        {stream ? (
                          <video
                            autoPlay
                            playsInline
                            ref={(video) => {

                              if (
                                video &&
                                stream &&
                                video.srcObject !== stream
                              ) {
                                video.srcObject = stream;
                              }

                            }}
                          />
                        ) : (
                          <div className="connecting">

                            <div className="avatar">
                              {user.username
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="connecting-name">
                              {user.username}
                            </div>

                            <div className="connecting-text">
                              Connecting...
                            </div>

                            <div className="loader"></div>

                          </div>
                        )}

                        <div className="video-name">

                          <span className="mic-status">
                            🎤
                          </span>

                          {user.username}

                        </div>

                      </div>

                    </div>
                  );

                }
              )}

            </section>


            <section className="controls">

              <button
                className={`control-button ${
                  muted ? "active" : ""
                }`}
                onClick={toggleMute}
              >
                <span className="control-icon">
                  {muted ? "🔇" : "🎤"}
                </span>

                <span>
                  {muted ? "Unmute" : "Mute"}
                </span>
              </button>


              <button
                className={`control-button ${
                  cameraOff ? "active" : ""
                }`}
                onClick={toggleCamera}
              >
                <span className="control-icon">
                  {cameraOff ? "📷" : "📹"}
                </span>

                <span>
                  {cameraOff
                    ? "Turn Camera On"
                    : "Turn Camera Off"}
                </span>
              </button>


              <button
                className="leave-button"
                onClick={leaveRoom}
              >
                <span className="control-icon">
                  ☎
                </span>

                Leave Room
              </button>

            </section>

          </main>

        </div>
      )}

    </div>
  );
}

export default App;