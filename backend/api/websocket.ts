import { WebSocketServer, WebSocket } from "ws";

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

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket) => {
  const userId = generateUserId();

  let currentRoom: string | null = null;
  let username = "";
  let muted = false;
  let cameraOff = false;

  console.log(`User connected: ${userId}`);

  const leaveRoom = () => {
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
    }

    currentRoom = null;
  };

  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "join-room") {
        const roomId = data.roomId;

        username = data.username;
        currentRoom = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        const room = rooms.get(roomId)!;

        const existingUsers = Array.from(room.entries()).map(
          ([existingUserId, user]) => ({
            userId: existingUserId,
            username: user.username,
            muted: user.muted,
            cameraOff: user.cameraOff,
          })
        );

        room.set(userId, {
          socket,
          username,
          muted,
          cameraOff,
        });

        socket.send(
          JSON.stringify({
            type: "room-joined",
            roomId,
            userId,
            username,
            muted,
            cameraOff,
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
                muted,
                cameraOff,
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
          muted = data.status.muted;
        }

        if (typeof data.status?.cameraOff === "boolean") {
          cameraOff = data.status.cameraOff;
        }

        currentUser.muted = muted;
        currentUser.cameraOff = cameraOff;

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
                  muted,
                  cameraOff,
                },
              })
            );
          }
        });

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

      if (data.type === "leave-room") {
        leaveRoom();
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  socket.on("close", () => {
    console.log(`User disconnected: ${userId}`);
    leaveRoom();
  });
});

export default wss;