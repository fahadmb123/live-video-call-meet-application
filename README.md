# Video Call Application

## LINK : https://meet-video-call-frontend.vercel.app/

A real-time video calling application built with React, TypeScript, Node.js, WebRTC, and WebSockets.

## Features

- Real-time video calling
- Real-time audio communication
- Multiple users in a room
- WebRTC peer-to-peer communication
- WebSocket signaling
- Mute and unmute microphone
- Turn camera on and off
- Participant status updates
- Join and leave rooms
- Responsive UI

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- WebRTC

### Backend

- Node.js
- Express
- TypeScript
- WebSocket
- ws

### Deployment

- Vercel

## Project Structure

```text
video-call-application
│
├── backend
│   ├── api
│   │   └── websocket.ts
│   ├── src
│   │   ├── types
│   │   ├── utils
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   └── vercel.json
│
└── frontend
    ├── src
    ├── public
    ├── package.json
    └── vite.config.ts