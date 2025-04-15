import { Socket } from "socket.io-client";

interface SocketEventsProps {
  socket: Socket;
  isLocalChange: boolean;
  setIsLocalChange: (value: boolean) => void;
  setIsConnected: (value: boolean) => void;
  clientId: string;
  setUserCount: (count: number) => void;
  currentFileId: string;
  setContent: (fileId: string, content: string) => void;
}

export function setupSocketEvents({
  socket,
  isLocalChange,
  setIsLocalChange,
  setIsConnected,
  clientId,
  setUserCount,
  currentFileId,
  setContent,
}: SocketEventsProps) {
  socket.on("init", (content: string) => {
    console.log(`Received init for default file:`, content.slice(0, 50));
    if (!isLocalChange && currentFileId === "default") {
      setContent("default", content || "");
    }
    setIsLocalChange(false);
  });

  socket.on(
    "update",
    ({ content, cursors, fileId, userId }: { content: string; cursors: Record<string, { offset: number; userId: string }>; fileId: string; userId: string }) => {
      console.log(`Received update for file ${fileId} from user ${userId}:`, content.slice(0, 50));
      if (fileId === currentFileId) {
        setContent(fileId, content || "");
      }
      socket.emit("updateCursors", cursors, fileId); // Reflect cursors back
    }
  );

  socket.on(
    "switchFile",
    ({ fileId, content }: { fileId: string; content: string }) => {
      console.log(`Received switchFile for ${fileId}:`, content.slice(0, 50));
      setContent(fileId, content || "");
    }
  );

  socket.on(
    "updateCursors",
    (cursors: Record<string, { offset: number; userId: string }>, fileId: string) => {
      if (fileId === currentFileId) {
        console.log(`Received cursors for file ${fileId}:`, cursors);
        // Handled in EditorContent via useEffect
      }
    }
  );

  socket.on("userCount", (count: number) => {
    console.log(`Received userCount: ${count}`);
    setUserCount(count);
  });

  return () => {
    socket.off("init");
    socket.off("update");
    socket.off("switchFile");
    socket.off("updateCursors");
    socket.off("userCount");
  };
}

export function emitEditEvent(
  socket: Socket,
  content: string,
  cursorOffset: number,
  clientId: string,
  fileId: string
) {
  socket.emit("edit", { content, cursorOffset, clientId, fileId });
}

export function emitCursorEvent(
  socket: Socket,
  cursorOffset: number,
  clientId: string,
  fileId: string
) {
  socket.emit("cursor", cursorOffset, fileId);
}