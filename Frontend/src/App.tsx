import { useEffect, useRef, useState } from "react";
import socket from "./ws/socket";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);


  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);


  const createPeerConnection = async () => {
    const peerConnection = new RTCPeerConnection();

    peerRef.current = peerConnection;

    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

   
    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    }

   
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
          })
        )
      }
    }

    return peerConnection;
  }

  
  const createOffer = async () => {
    const peerConnection = peerRef.current;

    if (!peerConnection) return;

    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    socket.send(
      JSON.stringify({
        type: "offer",
        offer,
      })
    );

    console.log("Offer sent")
  };

  
  const joinRoom = async () => {
    if (!roomId.trim()) return
    try {
      await createPeerConnection()

      socket.send(
        JSON.stringify({
          type: "join-room",
          roomId,
        })
      )
      setJoined(true)

      console.log(`Joined room: ${roomId}`)
    } catch (error) {
      console.error("Failed to join room:", error)
    }
  }
  useEffect(() => {
    if (joined && videoRef.current && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  useEffect(() => {
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data)

      console.log("Received:", message.type)

      const peerConnection = peerRef.current

      if (!peerConnection) return

      
      if (message.type === "user-joined") {
        console.log("Another user joined")
        await createOffer()
      }


      if (message.type === "offer") {
        console.log("Offer received")
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.offer)
        );

        const answer = await peerConnection.createAnswer()

        await peerConnection.setLocalDescription(answer)

        socket.send(
          JSON.stringify({
            type: "answer",
            answer,
          })
        );

        console.log("Answer sent");
      }


      if (message.type === "answer") {
        console.log("Answer received");

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.answer)
        )
      }

      if (message.type === "ice-candidate") {
        try {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(message.candidate)
          );

          console.log("ICE candidate added");
        } catch (error) {
          console.error("ICE candidate error:", error);
        }
      }
    }

    return () => {
      socket.onmessage = null;
    }
  }, [])

  return (
    <>
      {!joined && (
        <div>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />

          <button onClick={joinRoom}>
            Join Room
          </button>
        </div>
      )}

      {joined && (
        <div>
          <h2>My Video</h2>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
          />

          <h2>Remote Video</h2>

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
          />
        </div>
      )}
    </>
  );
}

export default App;