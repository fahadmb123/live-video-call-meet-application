import { useEffect, useRef, useState } from "react";
import socket from "../ws/socket";

import type {PeerMap,RemoteUser,} from "../types/webrtc";
import { toast } from "react-toastify";

function useWebRTC() {
  const localStreamRef =
    useRef<MediaStream | null>(null);

  const peersRef =
    useRef<PeerMap>(new Map());

  const pendingCandidatesRef =
    useRef<Map<string, RTCIceCandidate[]>>(
      new Map()
    );

  const [localStream, setLocalStream] =
    useState<MediaStream | null>(null);

  const [joined, setJoined] =
    useState(false);

  const [myUserId, setMyUserId] =
    useState("");

  const [remoteUsers, setRemoteUsers] =
    useState<Map<string, RemoteUser>>(
      new Map()
    );

  const [muted, setMuted] =
    useState(false);

  const [cameraOff, setCameraOff] =
    useState(false);

  const sendMessage = (data: object) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  const removePeer = (userId: string) => {
    const peerConnection =
      peersRef.current.get(userId);

    if (peerConnection) {
      peerConnection.close();

      peersRef.current.delete(userId);
    }

    pendingCandidatesRef.current.delete(
      userId
    );

    setRemoteUsers((previous) => {
      const updated = new Map(previous);

      updated.delete(userId);

      return updated;
    });
  };

  const createPeerConnection = (
    userId: string
  ) => {
    const existingPeer =
      peersRef.current.get(userId);

    if (existingPeer) {
      return existingPeer;
    }

    const peerConnection =
      new RTCPeerConnection({
        iceServers: [
          {
            urls:
              "stun:stun.l.google.com:19302",
          },
        ],
      });

    peersRef.current.set(
      userId,
      peerConnection
    );

    const stream =
      localStreamRef.current;

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => {
          peerConnection.addTrack(
            track,
            stream
          );
        });
    }

    peerConnection.ontrack = (
      event
    ) => {
      const stream =
        event.streams[0];

      if (!stream) {
        return;
      }

      setRemoteUsers((previous) => {
        const updated =
          new Map(previous);

        const existingUser =
          updated.get(userId);

        if (existingUser) {
          updated.set(userId, {
            ...existingUser,
            stream,
          });
        }

        return updated;
      });
    };

    peerConnection.onicecandidate = (
      event
    ) => {
      if (!event.candidate) {
        return;
      }

      sendMessage({
        type: "ice-candidate",
        candidate: event.candidate,
        target: userId,
      });
    };

    peerConnection.onconnectionstatechange =
      () => {
        console.log(
          `Connection state ${userId}:`,
          peerConnection.connectionState
        );

        if (
          peerConnection.connectionState ===
            "failed" ||
          peerConnection.connectionState ===
            "closed"
        ) {
          removePeer(userId);
        }
      };

    return peerConnection;
  };

  const createOffer = async (
    userId: string
  ) => {
    try {
      const peerConnection =
        createPeerConnection(
          userId
        );

      const offer =
        await peerConnection.createOffer();

      await peerConnection.setLocalDescription(
        offer
      );

      sendMessage({
        type: "offer",
        offer:
          peerConnection.localDescription,
        target: userId,
      });
    } catch (error) {
      console.error(
        "Offer error:",
        error
      );
    }
  };

  const addPendingCandidates =
    async (
      userId: string,
      peerConnection: RTCPeerConnection
    ) => {
      const candidates =
        pendingCandidatesRef.current.get(
          userId
        );

      if (!candidates) {
        return;
      }

      for (const candidate of candidates) {
        try {
          await peerConnection.addIceCandidate(
            candidate
          );
        } catch (error) {
          console.error(
            "ICE queue error:",
            error
          );
        }
      }

      pendingCandidatesRef.current.delete(
        userId
      );
    };

  const joinRoom = async (roomId: string,username: string) => {
    if (!roomId.trim()) {
      toast.error("Please enter a room ID")
      return false;
    }

    if (!username.trim()) {
      toast.error("Please enter your name")
      return false;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: true,
            audio: true,
          }
        );

      localStreamRef.current =
        stream;

      setLocalStream(stream);

      setJoined(true);

      sendMessage({
        type: "join-room",
        roomId: roomId.trim(),
        username: username.trim(),
      });

      return true;
    } catch (error) {
      console.error(
        "Camera/microphone error:",
        error
      );

      return false;
    }
  };

  const toggleMute = () => {
    const stream =
      localStreamRef.current;

    if (!stream) {
      return;
    }

    const audioTrack =
      stream.getAudioTracks()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled =
      !audioTrack.enabled;

    const isMuted =
      !audioTrack.enabled;

    setMuted(isMuted);

    sendMessage({
      type: "media-status",
      status: {
        muted: isMuted,
      },
    });
  };

  const toggleCamera = () => {
    const stream =
      localStreamRef.current;

    if (!stream) {
      return;
    }

    const videoTrack =
      stream.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    videoTrack.enabled =
      !videoTrack.enabled;

    const isCameraOff =
      !videoTrack.enabled;

    setCameraOff(isCameraOff);

    sendMessage({
      type: "media-status",
      status: {
        cameraOff: isCameraOff,
      },
    });
  };

  const leaveRoom = () => {
    sendMessage({
      type: "leave-room",
    });

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    peersRef.current.forEach(
      (peer) => {
        peer.close();
      }
    );

    peersRef.current.clear();

    pendingCandidatesRef.current.clear();

    localStreamRef.current = null;

    setLocalStream(null);

    setRemoteUsers(new Map());

    setJoined(false);

    setMyUserId("");

    setMuted(false);

    setCameraOff(false);
  };

  useEffect(() => {
    const handleMessage = async (
      event: MessageEvent
    ) => {
      try {
        const message =
          JSON.parse(event.data);

        console.log(
          "SIGNAL:",
          message.type,
          message
        );

        if (
          message.type ===
          "room-joined"
        ) {
          setMyUserId(
            message.userId
          );

          const users =
            message.users || [];

          for (const user of users) {
            if (
              user.userId ===
              message.userId
            ) {
              continue;
            }

            setRemoteUsers(
              (previous) => {
                const updated =
                  new Map(previous);

                updated.set(
                  user.userId,
                  {
                    username:
                      user.username,
                    muted:
                      user.muted ??
                      false,
                    cameraOff:
                      user.cameraOff ??
                      false,
                  }
                );

                return updated;
              }
            );

            await createOffer(
              user.userId
            );
          }

          return;
        }

        if (
          message.type ===
          "user-joined"
        ) {
          setRemoteUsers(
            (previous) => {
              const updated =
                new Map(previous);

              updated.set(
                message.userId,
                {
                  username:
                    message.username,
                  muted:
                    message.muted ??
                    false,
                  cameraOff:
                    message.cameraOff ??
                    false,
                }
              );

              return updated;
            }
          );

          return;
        }

        if (
          message.type === "offer"
        ) {
          const userId =
            message.from;

          if (!userId) {
            return;
          }

          const peerConnection =
            createPeerConnection(
              userId
            );

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              message.offer
            )
          );

          await addPendingCandidates(
            userId,
            peerConnection
          );

          const answer =
            await peerConnection.createAnswer();

          await peerConnection.setLocalDescription(
            answer
          );

          sendMessage({
            type: "answer",
            answer:
              peerConnection.localDescription,
            target: userId,
          });

          return;
        }

        if (
          message.type ===
          "answer"
        ) {
          const userId =
            message.from;

          if (!userId) {
            return;
          }

          const peerConnection =
            peersRef.current.get(
              userId
            );

          if (!peerConnection) {
            return;
          }

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              message.answer
            )
          );

          await addPendingCandidates(
            userId,
            peerConnection
          );

          return;
        }

        if (
          message.type ===
          "ice-candidate"
        ) {
          const userId =
            message.from;

          if (!userId) {
            return;
          }

          const candidate =
            new RTCIceCandidate(
              message.candidate
            );

          const peerConnection =
            peersRef.current.get(
              userId
            );

          if (!peerConnection) {
            let candidates =
              pendingCandidatesRef.current.get(
                userId
              );

            if (!candidates) {
              candidates = [];

              pendingCandidatesRef.current.set(
                userId,
                candidates
              );
            }

            candidates.push(
              candidate
            );

            return;
          }

          if (
            peerConnection.remoteDescription
          ) {
            try {
              await peerConnection.addIceCandidate(
                candidate
              );
            } catch (error) {
              console.error(
                "ICE candidate error:",
                error
              );
            }
          } else {
            let candidates =
              pendingCandidatesRef.current.get(
                userId
              );

            if (!candidates) {
              candidates = [];

              pendingCandidatesRef.current.set(
                userId,
                candidates
              );
            }

            candidates.push(
              candidate
            );
          }

          return;
        }

        if (
          message.type ===
          "media-status"
        ) {
          const userId =
            message.from;

          if (!userId) {
            return;
          }

          setRemoteUsers(
            (previous) => {
              const updated =
                new Map(previous);

              const existingUser =
                updated.get(userId);

              if (!existingUser) {
                return previous;
              }

              updated.set(
                userId,
                {
                  ...existingUser,
                  muted:
                    message.status
                      ?.muted ??
                    existingUser.muted,
                  cameraOff:
                    message.status
                      ?.cameraOff ??
                    existingUser.cameraOff,
                }
              );

              return updated;
            }
          );

          return;
        }

        if (
          message.type ===
          "user-left"
        ) {
          removePeer(
            message.userId
          );

          return;
        }
      } catch (error) {
        console.error(
          "WebSocket message error:",
          error
        );
      }
    };

    socket.onmessage =
      handleMessage;

    return () => {
      socket.onmessage = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      localStreamRef.current
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });

      peersRef.current.forEach(
        (peer) => {
          peer.close();
        }
      );

      peersRef.current.clear();
    };
  }, []);

  return {
    joined,
    myUserId,
    localStream,
    remoteUsers,
    muted,
    cameraOff,
    joinRoom,
    toggleMute,
    toggleCamera,
    leaveRoom,
  };
}

export default useWebRTC;