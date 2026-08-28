import express from "express";
import cors from "cors";
import WebSocket from "ws";
import { WebSocketServer } from "ws";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

type User = {
  socket: WebSocket;
  username: string;
  muted: boolean;
  cameraOff: boolean;
};

const rooms = new Map<string, Map<string, User>>();

const generateUserId = () => {
  return Math.random().toString(36).substring(2, 9);
};

wss.on("connection", (socket) => {
  const userId = generateUserId();

  console.log(`User connected: ${userId}`);

  let currentRoom: string | null = null;
  let username = "";

  socket.on("message", (message) => {
    const data = JSON.parse(message.toString());

    // ============================================
    // JOIN ROOM
    // ============================================

    if (data.type === "join-room") {
      const roomId = data.roomId;

      username = data.username;
      currentRoom = roomId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId)!;

      // Get users already inside the room
      const existingUsers = Array.from(
        room.entries()
      ).map(([existingUserId, user]) => ({
        userId: existingUserId,
        username: user.username,
        muted: user.muted,
        cameraOff: user.cameraOff,
      }));

   
      room.set(userId, {
        socket,
        username,
        muted: false,
        cameraOff: false,
      });

      console.log(
        `${username} (${userId}) joined room: ${roomId}`
      );

  
      socket.send(
        JSON.stringify({
          type: "room-joined",
          roomId,
          userId,
          username,
          users: existingUsers,
        })
      );

   
      room.forEach((user, existingUserId) => {
        if (
          existingUserId !== userId &&
          user.socket.readyState === WebSocket.OPEN
        ) {
          user.socket.send(
            JSON.stringify({
              type: "user-joined",
              userId,
              username,
              muted: false,
              cameraOff: false,
            })
          );
        }
      });

      return;
    }

    if (data.type === "media-status") {
      if (!currentRoom) return;

      const room = rooms.get(currentRoom);

      if (!room) return;

      const currentUser = room.get(userId);

      if (!currentUser) return;

      if (typeof data.status?.muted === "boolean") {
        currentUser.muted = data.status.muted;
      }

      if (typeof data.status?.cameraOff === "boolean") {
        currentUser.cameraOff = data.status.cameraOff;
      }

      console.log(
        `${username} media status:`,
        {
          muted: currentUser.muted,
          cameraOff: currentUser.cameraOff,
        }
      );

      room.forEach((user, existingUserId) => {
        if (
          existingUserId !== userId &&
          user.socket.readyState === WebSocket.OPEN
        ) {
          user.socket.send(
            JSON.stringify({
              type: "media-status",
              from: userId,
              status: {
                muted: currentUser.muted,
                cameraOff: currentUser.cameraOff,
              },
            })
          );
        }
      });

      return;
    }


    if (data.type === "leave-room") {
      if (!currentRoom) return;

      const room = rooms.get(currentRoom);

      if (!room) return;

      room.delete(userId);

      room.forEach((user) => {
        if (user.socket.readyState === WebSocket.OPEN) {
          user.socket.send(
            JSON.stringify({
              type: "user-left",
              userId,
            })
          );
        }
      });

      console.log(
        `${username} left room: ${currentRoom}`
      );

      if (room.size === 0) {
        rooms.delete(currentRoom);

        console.log(
          `Room deleted: ${currentRoom}`
        );
      }

      currentRoom = null;

      return;
    }

    if (
      data.type === "offer" ||
      data.type === "answer" ||
      data.type === "ice-candidate"
    ) {
      if (!currentRoom) return;

      const room = rooms.get(currentRoom);

      if (!room) return;

      const targetUser = room.get(data.target);

      if (
        targetUser &&
        targetUser.socket.readyState === WebSocket.OPEN
      ) {
        targetUser.socket.send(
          JSON.stringify({
            ...data,
            from: userId,
          })
        );
      }

      return;
    }
  });

  socket.on("close", () => {
    console.log(
      `User disconnected: ${username} (${userId})`
    );

    if (!currentRoom) return;

    const room = rooms.get(currentRoom);

    if (!room) return;

    room.delete(userId);

    room.forEach((user) => {
      if (user.socket.readyState === WebSocket.OPEN) {
        user.socket.send(
          JSON.stringify({
            type: "user-left",
            userId,
          })
        );
      }
    });

    if (room.size === 0) {
      rooms.delete(currentRoom);

      console.log(
        `Room deleted: ${currentRoom}`
      );
    }
  });
});