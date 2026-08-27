import { useEffect, useRef } from "react";
import socket from "./ws/socket";


function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    const setupWebRTC = async () => {
      try {
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

       
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        const peerConnection = new RTCPeerConnection()
                peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0]
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

        peerRef.current = peerConnection

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream)
        })

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)


        socket.onmessage = async (event)=>{
          const message = JSON.parse(event.data)
          if (message.type === "offer") {
            const peerConnection = peerRef.current

            if (!peerConnection) return

            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            socket.send(
              JSON.stringify({
                type: "answer",
                answer,
              })
            )
          }


          if (message.type === "answer") {
            const peerConnection = peerRef.current
            if (!peerConnection) return
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
            console.log("Answer received")
          }


          if (message.type === "ice-candidate") {
            const peerConnection = peerRef.current;

            if (!peerConnection) return;

            await peerConnection.addIceCandidate(
              new RTCIceCandidate(message.candidate)
            );

            console.log("ICE candidate added");
          }
        }

        socket.send(JSON.stringify({
          type:"offer",
          offer
        }))
      } catch (error) {
        console.error(error)
      }
    }

    if (socket.readyState === WebSocket.OPEN){
      setupWebRTC()
    }else {
      socket.onopen = setupWebRTC
    }

    return ()=>{
      socket.onopen = null
    }
  }, [])

  return (
    <div>
      <h1>WebRTC Video Call</h1>

      <div>
        <h2>My Video</h2>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
        />
      </div>

      <div>
        <h2>Remote Video</h2>

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
        />
      </div>
    </div>
  )
}

export default App;