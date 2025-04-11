import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection } from "../sockets/socket";
import {
  setupSocketEvents,
  emitEditEvent,
  emitCursorEvent,
} from "../sockets/socketEvents";
import { useNavigate } from "react-router-dom";

const Editor = ({ sessionId }: { sessionId: string }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const clientId = Math.random().toString(36).substring(2, 8);

  useEffect(() => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = createSocketConnection(sessionId);
    const cleanup = setupSocketEvents({
      socket: socketRef.current,
      editorRef,
      isLocalChange,
      setIsLocalChange,
      setIsConnected,
      setUserCount,
      clientId,
    });

    // Track cursor movements
    const handleSelectionChange = () => {
      if (socketRef.current) {
        const cursorOffset = getCursorOffset();
        emitCursorEvent(socketRef.current, cursorOffset, clientId);
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      cleanup();
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [sessionId]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setIsLocalChange(true);
    if (socketRef.current) {
      const cursorOffset = getCursorOffset();
      emitEditEvent(socketRef.current, newContent, cursorOffset, clientId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertParagraph");
    }
  };

  const getCursorOffset = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current!);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
    return 0;
  };
  const navigate = useNavigate();

  const handleReturnHome = () => {
    navigate(`/`);
  };

  return (
    <div>
      <div className="flex justify-between m-3 bg-blue-300">
        <p>Users: {userCount}</p>
        <button className="border-1 p-1 rounded-2xl" onClick={handleReturnHome}>
          Go back
        </button>
      </div>
      <div
        ref={editorRef}
        className="h-screen w-screen p-8 text-lg outline-none overflow-auto bg-white relative"
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder="Start typing here..."
        suppressContentEditableWarning={true}
      />
    </div>
  );
};

export default Editor;
