export type PeerMap = Map<
  string,
  RTCPeerConnection
>;

export type RemoteUser = {
  username: string;
  stream?: MediaStream;
  muted: boolean;
  cameraOff: boolean;
};