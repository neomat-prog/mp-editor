import { io, Socket } from "socket.io-client";

export const createSocketConnection = (
  sessionId: string,
  isPrivate?: boolean,
  password?: string
): Socket => {
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:5137";
  const query = new URLSearchParams({
    sessionId,
    ...(isPrivate && { isPrivate: isPrivate.toString() }),
    ...(password && { password }),
  }).toString();
  const socket = io(`${serverUrl}?${query}`, {
    withCredentials: true,
    transports: ["websocket"],
  });
  return socket;
};