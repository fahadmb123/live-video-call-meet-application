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
const clients :WebSocket[] = []


wss.on("connection", (socket) => {
  console.log("Client connected")
  clients.push(socket)

  socket.on("message",(message)=>{
    clients.forEach(client=>{
        if (client !== socket && client.readyState === WebSocket.OPEN){
            client.send(message.toString())
        }
    })
  })
  socket.on("close", () => {
    console.log("Client disconnected")
    const index = clients.indexOf(socket)
    if (index !== -1){
        clients.splice(index,1)
    }
  })
})