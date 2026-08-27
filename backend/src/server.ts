import express from "express";
import cors from "cors";
import WebSocket from "ws";
import { WebSocketServer } from "ws";

const app = express()

app.use(cors())
app.use(express.json())

const PORT = 5000



const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});



const wss = new WebSocketServer({ server })
const rooms = new Map<string,WebSocket[]>()


wss.on("connection", (socket) => {
  console.log("Client connected")

  let currentRoom: string | null = null

  socket.on("message", (message) => {
    const data = JSON.parse(message.toString())

    if (data.type === "join-room") {

      const roomId = data.roomId
      currentRoom = roomId

      if (!rooms.has(roomId)) {
        rooms.set(roomId, [])
      }
      const room = rooms.get(roomId)!

      room.push(socket)

      console.log(`Client joined room: ${roomId}`)
      socket.send(
        JSON.stringify({
          type: "room-joined",
          roomId,
          users: room.length,
        })
      )

      room.forEach((client) => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "user-joined",
            })
          )
        }
      })
    }

    if (data.type === "offer" || data.type === "answer" || data.type === "ice-candidate") {
      if (!currentRoom) return
      const room = rooms.get(currentRoom)
      if (!room) return
      room.forEach((client) => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(message.toString())
        }
      });
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected")

    if (!currentRoom) return;

    const room = rooms.get(currentRoom)

    if (!room) return;

    const index = room.indexOf(socket)

    if (index !== -1) {
      room.splice(index, 1)
    }

    if (room.length === 0) {
      rooms.delete(currentRoom)
    }
  })
})