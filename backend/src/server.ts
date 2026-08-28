import app from "./app";
import { createWebSocketServer } from "./websocket/websocketServer";

const PORT = 5000;

const server = app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);

createWebSocketServer(server);