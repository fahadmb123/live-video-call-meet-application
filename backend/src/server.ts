import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

const app = express()

app.use(cors())
app.use(express.json())

const PORT = 5000

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});

const wss = new WebSocketServer({ server })

wss.on("connection", (socket) => {
  console.log("Client connected")
  socket.on("message",(message)=>{
    console.log("Message Recieved ",message)
  })
  socket.on("close", () => {
    console.log("Client disconnected")
  })
})