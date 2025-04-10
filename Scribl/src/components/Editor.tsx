import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection } from "../sockets/socket";
import { setupSocketEvents, emitEditEvent } from "../sockets/socketEvents";

const Editor = ({ sessionId }: { sessionId: string }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLocalChange, setIsLocalChange] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const clientId = Math.random().toString(36).substring(2, 8);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = createSocketConnection(sessionId);

    const cleanup = setupSocketEvents({
      socket: socketRef.current,
      editorRef,
      isLocalChange,
      setIsLocalChange,
      setIsConnected,
      clientId,
    });

    return () => {
      cleanup();
    };
  }, [sessionId]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setIsLocalChange(true);
    if (socketRef.current) {
      emitEditEvent(socketRef.current, newContent, clientId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertParagraph");
    }
  };

  return (
    <div
      ref={editorRef}
      className="h-screen w-screen p-8 text-lg outline-none overflow-auto bg-white"
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder="Start typing here..."
      suppressContentEditableWarning={true}
    />
  );
};

export default Editor;
