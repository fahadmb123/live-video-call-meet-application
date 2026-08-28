import { useEffect, useRef, useState } from "react";
import socket from "./ws/socket";

type PeerMap = Map<string, RTCPeerConnection>;
type StreamMap = Map<string, MediaStream>;

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerMap>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map())
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [remoteStreams, setRemoteStreams] = useState<StreamMap>(new Map())


  const toggleMute = () => {
    const stream = localStreamRef.current
    if (!stream) return

    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled
    setMuted(!audioTrack.enabled)
  }
  const toggleCamera = () => {
    const stream = localStreamRef.current
    if (!stream) return
    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) return
    videoTrack.enabled = !videoTrack.enabled
    setCameraOff(!videoTrack.enabled)
  }



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
      const stream = event.streams[0];

      setRemoteStreams((previous) => {
        const updated = new Map(previous);
        updated.set(userId, stream);
        return updated;
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          target: userId,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection with ${userId}:`,
        peerConnection.connectionState
      );

      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed" ||
        peerConnection.connectionState === "disconnected"
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

    setRemoteStreams((previous) => {
      const updated = new Map(previous);
      updated.delete(userId);
      return updated;
    });
  };

  const addPendingCandidates = async (
    userId: string,
    peerConnection: RTCPeerConnection
  ) => {
    const candidates = pendingCandidatesRef.current.get(userId);

    if (!candidates) return;

    for (const candidate of candidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Failed to add queued ICE candidate:", error);
      }
    }

    pendingCandidatesRef.current.delete(userId);
  };

  const createOffer = async (userId: string) => {
    try {
      const peerConnection = createPeerConnection(userId);

      const offer = await peerConnection.createOffer();

      await peerConnection.setLocalDescription(offer);

      sendMessage({
        type: "offer",
        offer,
        target: userId,
      });

      console.log(`Offer sent to ${userId}`);
    } catch (error) {
      console.error(`Failed to create offer for ${userId}:`, error);
    }
  };

  const joinRoom = async () => {
    if (!roomId.trim()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      setJoined(true);

      if (socket.readyState !== WebSocket.OPEN) {
        console.log("WebSocket is not connected");
        return;
      }

      sendMessage({
        type: "join-room",
        roomId: roomId.trim(),
      });

      console.log(`Joining room: ${roomId.trim()}`);
    } catch (error) {
      console.error("Failed to access camera/microphone:", error);
    }
  };

  useEffect(() => {
    if (joined && videoRef.current && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        console.log("Received:", message.type, message);

        if (message.type === "room-joined") {
          setMyUserId(message.userId);

          console.log("My user ID:", message.userId);
          console.log("Users in room:", message.users);

          return;
        }

        if (message.type === "user-joined") {
          const userId = message.userId;

          if (!userId || userId === myUserId) return;

          console.log(`New user joined: ${userId}`);

          await createOffer(userId);

          return;
        }

        if (message.type === "offer") {
          const userId = message.from;

          if (!userId || userId === myUserId) return;

          console.log(`Offer received from ${userId}`);

          const peerConnection = createPeerConnection(userId);

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.offer)
          );

          await addPendingCandidates(userId, peerConnection);

          const answer = await peerConnection.createAnswer();

          await peerConnection.setLocalDescription(answer);

          sendMessage({
            type: "answer",
            answer,
            target: userId,
          });

          console.log(`Answer sent to ${userId}`);

          return;
        }

        if (message.type === "answer") {
          const userId = message.from;

          if (!userId) return;

          console.log(`Answer received from ${userId}`);

          const peerConnection = peersRef.current.get(userId);

          if (!peerConnection) {
            console.log(`No peer connection found for ${userId}`);
            return;
          }

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.answer)
          );

          await addPendingCandidates(userId, peerConnection);

          return;
        }

        if (message.type === "ice-candidate") {
          const userId = message.from;

          if (!userId) return;

          const peerConnection = peersRef.current.get(userId);

          if (!peerConnection) {
            let candidates = pendingCandidatesRef.current.get(userId);

            if (!candidates) {
              candidates = [];
              pendingCandidatesRef.current.set(userId, candidates);
            }

            candidates.push(new RTCIceCandidate(message.candidate));

            return;
          }

          if (peerConnection.remoteDescription) {
            try {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );

              console.log(`ICE candidate added from ${userId}`);
            } catch (error) {
              console.error("ICE candidate error:", error);
            }
          } else {
            let candidates = pendingCandidatesRef.current.get(userId);

            if (!candidates) {
              candidates = [];
              pendingCandidatesRef.current.set(userId, candidates);
            }

            candidates.push(new RTCIceCandidate(message.candidate));
          }

          return;
        }

        if (message.type === "user-left") {
          const userId = message.userId;

          if (!userId) return;

          console.log(`User left: ${userId}`);

          removePeer(userId);

          return;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    socket.onmessage = handleMessage;

    return () => {
      socket.onmessage = null;
    };
  }, [myUserId]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      peersRef.current.forEach((peerConnection) => {
        peerConnection.close();
      });

      peersRef.current.clear();
    };
  }, []);

  return (
    <>
      {!joined && (
        <div>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
          />

          <button onClick={joinRoom}>
            Join Room
          </button>
        </div>
      )}

      {joined && (
        <div>
          <h2>Room: {roomId}</h2>

          <h3>My Video</h3>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            width="400"
          />

          <h3>My ID: {myUserId}</h3>
          <button onClick={toggleMute}>
            {muted ? "Unmute 🎤" : "Mute 🔇"}
          </button>
          <button onClick={toggleCamera}>
            {cameraOff ? "Turn Camera On 📷" : "Turn Camera Off 📷"}
          </button>
          <h3>Remote Users: {remoteStreams.size}</h3>

          <div>
            {Array.from(remoteStreams.entries()).map(
              ([userId, stream]) => (
                <div key={userId}>
                  <p>User: {userId}</p>

                  <video
                    autoPlay
                    playsInline
                    width="400"
                    ref={(video) => {
                      if (video && video.srcObject !== stream) {
                        video.srcObject = stream;
                      }
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;