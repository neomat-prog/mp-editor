import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";


const Editor = () => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [isLocalChange, setIsLocalChange] = useState(false);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setIsLocalChange(true);
    socketRef.current?.emit("edit", newContent);
    console.log("Emitted edit:", newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertParagraph");
    }
  };

  useEffect(() => {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
    const socket = io(serverUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server:", socket.id);
    });
    socket.on("connect_error", (err) => {
      console.error("Connection failed:", err.message);
    });

    socket.on("init", (content: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = content;
      }
    });

    socket.on("update", (content: string) => {
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
  }, []);

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
