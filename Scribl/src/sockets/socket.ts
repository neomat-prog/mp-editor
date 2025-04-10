import { io, Socket } from "socket.io-client";

export const createSocketConnection = (sessionId: string): Socket => {
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:5137";
  const socket = io(`${serverUrl}?sessionId=${sessionId}`, {
    withCredentials: true,
    transports: ["websocket"],
  });
  return socket;
};
