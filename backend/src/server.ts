import express from "express";
import cors from "cors";
import WebSocket from "ws";
import { WebSocketServer } from "ws";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

const wss = new WebSocketServer({ server })

const rooms = new Map<string, Map<string, WebSocket>>()

const generateUserId = () => {
  return Math.random().toString(36).substring(2, 9)
}



wss.on("connection", (socket) => {
  const userId = generateUserId()
  console.log(`User connected: ${userId}`)
  let currentRoom: string | null = null

  socket.on("message", (message) => {
    const data = JSON.parse(message.toString())
    if (data.type === "join-room") {
      const roomId = data.roomId
      currentRoom = roomId
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map())
      }
      const room = rooms.get(roomId)!
      room.set(userId, socket)
      console.log(`${userId} joined room: ${roomId}`);
      socket.send(
        JSON.stringify({
          type: "room-joined",
          roomId,
          userId,
        })
      )
      room.forEach((client, existingUserId) => {
        if ( existingUserId !== userId && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "user-joined",
              userId,
            })
          )
        }
      })
    }


    if (data.type === "leave-room") {
      if (!currentRoom) return
      const room = rooms.get(currentRoom)

      if (!room) return

      room.delete(userId)
      room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "user-left",
              userId,
            })
          )
        }
      })
      console.log(`${userId} left room: ${currentRoom}`)
      if (room.size === 0) {
        rooms.delete(currentRoom)
        console.log(`Room deleted: ${currentRoom}`)
      }
      currentRoom = null
    }

    if (data.type === "offer" || data.type === "answer" || data.type === "ice-candidate") {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const targetSocket = room.get(data.target)
      if (
        targetSocket &&
        targetSocket.readyState === WebSocket.OPEN
      ) {
        targetSocket.send(
          JSON.stringify({
            ...data,
            from: userId,
          })
        )
      }
    }
  })

  socket.on("close", () => {
    console.log(`User disconnected: ${userId}`);
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.delete(userId);
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "user-left",
            userId,
          })
        )
      }
    })
    if (room.size === 0) {
      rooms.delete(currentRoom);
      console.log(`Room deleted: ${currentRoom}`);
    }
  })
})