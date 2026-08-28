import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

type User = {
  socket: WebSocket;
  username: string;
  muted: boolean;
  cameraOff: boolean;
};

const rooms = new Map<string, Map<string, User>>();

const generateUserId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

const wss = new WebSocketServer({
  noServer: true,
});

const handleConnection = (socket: WebSocket) => {
  const userId = generateUserId();

  let currentRoom: string | null = null;
  let username = "";
  let muted = false;
  let cameraOff = false;

  console.log(`User connected: ${userId}`);

  const send = (data: object) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  const leaveRoom = () => {
    if (!currentRoom) {
      return;
    }

    const room = rooms.get(currentRoom);

    if (!room) {
      currentRoom = null;
      return;
    }

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

  socket.on("message", (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());

      if (data.type === "join-room") {
        const roomId = String(data.roomId || "");
        username = String(data.username || "");

        if (!roomId || !username) {
          return;
        }

        currentRoom = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }

        const room = rooms.get(roomId);

        if (!room) {
          return;
        }

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

        send({
          type: "room-joined",
          roomId,
          userId,
          username,
          muted,
          cameraOff,
          users: existingUsers,
        });

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
        if (!currentRoom) {
          return;
        }

        const room = rooms.get(currentRoom);

        if (!room) {
          return;
        }

        const currentUser = room.get(userId);

        if (!currentUser) {
          return;
        }

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
        if (!currentRoom) {
          return;
        }

        const room = rooms.get(currentRoom);

        if (!room) {
          return;
        }

        const targetUser = room.get(String(data.target));

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

  socket.on("error", (error) => {
    console.error(`WebSocket error ${userId}:`, error);
    leaveRoom();
  });
};

wss.on("connection", handleConnection);

export default async function handler(
  request: IncomingMessage,
  response: any
) {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") {
    response.statusCode = 426;
    response.end("WebSocket Upgrade Required");
    return;
  }

  const socket = (response as any).socket;

  if (!socket) {
    response.statusCode = 500;
    response.end("WebSocket socket unavailable");
    return;
  }

  wss.handleUpgrade(
    request,
    socket,
    Buffer.alloc(0),
    (ws) => {
      wss.emit("connection", ws, request);
    }
  );
}