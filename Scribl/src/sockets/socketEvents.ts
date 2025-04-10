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

  socket.on("update", ({ content, cursors }) => {
    console.log(`[${clientId}] Received update:`, content, cursors);
    if (!isLocalChange && editorRef.current) {
      editorRef.current.innerHTML = content;
      renderCursors(cursors, editorRef, socket.id);
    }
    setIsLocalChange(false);
  });

  socket.on("updateCursors", (cursors) => {
    console.log(`[${clientId}] Received cursor update:`, cursors);
    if (editorRef.current) {
      renderCursors(cursors, editorRef, socket.id);
    }
  });

  return () => {
    socket.disconnect();
  };
};

export const emitEditEvent = (socket: Socket, content: string, cursorOffset: number, clientId: string) => {
  socket.emit("edit", { content, cursorOffset });
  console.log(`[${clientId}] Emitted edit:`, content, `cursor at ${cursorOffset}`);
};

export const emitCursorEvent = (socket: Socket, cursorOffset: number, clientId: string) => {
  socket.emit("cursor", cursorOffset);
  console.log(`[${clientId}] Emitted cursor:`, cursorOffset);
};

function renderCursors(cursors: { [socketId: string]: { offset: number } }, editorRef: RefObject<HTMLDivElement>, localSocketId: string) {
  if (!editorRef.current) return;

  // Remove existing cursors
  const existingCursors = editorRef.current.querySelectorAll(".remote-cursor");
  existingCursors.forEach((cursor) => cursor.remove());

  // Render each remote cursor
  Object.entries(cursors).forEach(([socketId, { offset }]) => {
    if (socketId === localSocketId) return; 

    const range = document.createRange();
    const textNode = editorRef.current.childNodes[0] || document.createTextNode("");
    try {
      const position = Math.min(offset, textNode.length);
      range.setStart(textNode, position);
      range.setEnd(textNode, position);

      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      const cursorEl = document.createElement("span");
      cursorEl.className = "remote-cursor";
      cursorEl.style.cssText = `
        position: absolute;
        left: ${rect.left - editorRect.left}px;
        top: ${rect.top - editorRect.top}px;
        width: 2px;
        height: 1.2em;
        background-color: ${getColorFromId(socketId)};
        animation: blink 1s infinite;
      `;
      editorRef.current.appendChild(cursorEl);
    } catch (err) {
      console.warn(`[${socketId}] Invalid cursor offset:`, err.message);
    }
  });
}

function getColorFromId(socketId: string) {
  const hash = socketId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 70%, 50%)`;
}