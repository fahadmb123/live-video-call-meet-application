import { useState } from "react";
import "./App.css";
import JoinPage from "./components/JoinPage";
import MeetingPage from "./components/MeetingPage";
import useWebRTC from "./hooks/useWebRTC";
import { ToastContainer } from 'react-toastify';


function App() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  const {joined,localStream,remoteUsers,muted, cameraOff, joinRoom, toggleMute, toggleCamera, leaveRoom,} = useWebRTC()


  const handleJoin = async () => {
    await joinRoom(roomId,username)
  }

  return (
    <div className="app">
      <ToastContainer/>
      {!joined ? (
        <JoinPage
          roomId={roomId}
          username={username}
          setRoomId={setRoomId}
          setUsername={setUsername}
          onJoin={handleJoin}
        />
      ) : (
        <MeetingPage
          roomId={roomId}
          username={username}
          localStream={localStream}
          remoteUsers={remoteUsers}
          muted={muted}
          cameraOff={cameraOff}
          onMute={toggleMute}
          onCamera={toggleCamera}
          onLeave={leaveRoom}
        />
      )}
    </div>
  );
}

export default App;