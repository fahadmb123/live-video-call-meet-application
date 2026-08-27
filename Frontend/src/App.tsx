import { useEffect, useRef } from "react";
import socket from "./ws/socket";


function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
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

        peerRef.current = peerConnection

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream)
        })

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        
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

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
      />
    </div>
  );
}

export default App;