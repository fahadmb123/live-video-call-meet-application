import WebSocket from "ws";

export type User = {
  socket: WebSocket;
  username: string;
  muted: boolean;
  cameraOff: boolean;
};