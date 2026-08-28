const socket = new WebSocket("wss://meet-video-call-backend-three.vercel.app/api/websocket");

socket.onopen = () => {
  console.log("WebSocket connected");
};

socket.onclose = () => {
  console.log("WebSocket disconnected");
};

socket.onerror = (error) => {
  console.error("WebSocket error:", error);
};

export default socket;