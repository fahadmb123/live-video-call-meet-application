import { useEffect, useRef } from "react";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRef.current) {
          console.log(stream)
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error("Camera/Microphone error:", error)
      }
    };

    getMedia()
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