const socket = new WebSocket("ws://localhost:5000")

socket.onopen = () => {
  console.log("WebSocket connected")
};

socket.onclose = () => {
  console.log("WebSocket disconnected")
};

socket.onerror = (error) => {
  console.error("WebSocket error:", error)
};

export default socket