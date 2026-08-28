import WebSocket, {WebSocketServer,} from "ws";
import generateUserId from "../utils/generateUserId";
import { User } from "../types/room";

const rooms = new Map<string,Map<string, User>>();

export const createWebSocketServer = (
  server: any
) => {
  const wss = new WebSocketServer({
    server,
  });

  wss.on("connection", (socket) => {
    const userId = generateUserId();

    console.log(
      `User connected: ${userId}`
    );

    let currentRoom: string | null = null;
    let username = "";

    socket.on("message", (message) => {
      try {
        const data = JSON.parse(
          message.toString()
        );

      

        if (data.type === "join-room") {
          const roomId = data.roomId;

          username = data.username;
          currentRoom = roomId;

          if (!rooms.has(roomId)) {
            rooms.set(
              roomId,
              new Map()
            );
          }

          const room = rooms.get(roomId)!;

          

          const existingUsers =
            Array.from(room.entries()).map(
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

          
          
          room.forEach(
            (user, existingUserId) => {
              if (
                existingUserId !== userId &&
                user.socket.readyState ===
                  WebSocket.OPEN
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
            }
          );

          return;
        }

      



        if (data.type === "leave-room") {
          leaveRoom(
            userId,
            currentRoom,
            username
          );

          currentRoom = null;

          return;
        }




        if (data.type === "media-status") {
          if (!currentRoom) return;

          const room =
            rooms.get(currentRoom);

          if (!room) return;

          const currentUser =
            room.get(userId);

          if (!currentUser) return;

          
          if (
            data.status?.muted !== undefined
          ) {
            currentUser.muted =
              data.status.muted;
          }

          
          if (
            data.status?.cameraOff !==
            undefined
          ) {
            currentUser.cameraOff =
              data.status.cameraOff;
          }

          
          room.forEach(
            (user, targetUserId) => {
              if (
                targetUserId !== userId &&
                user.socket.readyState ===
                  WebSocket.OPEN
              ) {
                user.socket.send(
                  JSON.stringify({
                    type: "media-status",
                    from: userId,
                    status: {
                      muted:
                        currentUser.muted,
                      cameraOff:
                        currentUser.cameraOff,
                    },
                  })
                );
              }
            }
          );

          return;
        }

       
        



        if (
          data.type === "offer" ||
          data.type === "answer" ||
          data.type === "ice-candidate"
        ) {
          if (!currentRoom) return;

          const room =
            rooms.get(currentRoom);

          if (!room) return;

          const targetUser =
            room.get(data.target);

          if (
            targetUser &&
            targetUser.socket.readyState ===
              WebSocket.OPEN
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
      } catch (error) {
        console.error(
          "WebSocket message error:",
          error
        );
      }
    });

    
    

    socket.on("close", () => {
      console.log(
        `User disconnected: ${username} (${userId})`
      );

      leaveRoom(
        userId,
        currentRoom,
        username
      );
    });
  });

  return wss;
};





const leaveRoom = (
  userId: string,
  currentRoom: string | null,
  username: string
) => {
  if (!currentRoom) return;

  const room =
    rooms.get(currentRoom);

  if (!room) return;

  room.delete(userId);

  room.forEach((user) => {
    if (
      user.socket.readyState ===
      WebSocket.OPEN
    ) {
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
};