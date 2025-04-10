import { RefObject } from "react";
import { Socket } from "socket.io-client";

interface SocketEventsProps {
  socket: Socket;
  editorRef: RefObject<HTMLDivElement>;
  isLocalChange: boolean;
  setIsLocalChange: (value: boolean) => void;
  setIsConnected: (value: boolean) => void;
  clientId: string;
}

export const setupSocketEvents = ({
  socket,
  editorRef,
  isLocalChange,
  setIsLocalChange,
  setIsConnected,
  clientId,
}: SocketEventsProps) => {
  socket.on("connect", () => {
    setIsConnected(true);
    console.log(`[${clientId}] Connected to server:`, socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error(`[${clientId}] Connection failed:`, err.message);
  });

  socket.on("init", (content: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
      console.log(`[${clientId}] Initialized with:`, content);
    }
  });

  socket.on("update", (content: string) => {
    console.log(`[${clientId}] Received update:`, content);
    if (!isLocalChange && editorRef.current) {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      editorRef.current.innerHTML = content;
      if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    setIsLocalChange(false);
  });

  return () => {
    socket.disconnect();
  };
};

export const emitEditEvent = (socket: Socket, content: string, clientId: string) => {
  socket.emit("edit", content);
  console.log(`[${clientId}] Emitted edit:`, content);
};