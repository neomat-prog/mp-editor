import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useLocation } from "react-router-dom";
import { createSocketConnection } from "../sockets/socket";
import { setupSocketEvents, emitEditEvent, emitCursorEvent } from "../sockets/socketEvents";

const Editor = ({ sessionId }: { sessionId: string }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const clientId = Math.random().toString(36).substring(2, 8);
  const location = useLocation();
  const { isPrivate, password } = location.state || {};
  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = Math.random().toString(36).substring(2, 12);
    localStorage.setItem("userId", userId);
  }

  const connectSocket = (pwd?: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = createSocketConnection(sessionId, isPrivate, pwd);

    return new Promise<void>((resolve, reject) => {
      socketRef.current?.on("connect", () => {
        setIsConnected(true); // Set directly here for reliability
        socketRef.current?.emit("setUserId", { userId, isCreator: isPrivate && !!password });
        const cleanup = setupSocketEvents({
          socket: socketRef.current!,
          editorRef,
          isLocalChange,
          setIsLocalChange,
          setIsConnected,
          clientId,
          setUserCount,
        });

        const handleSelectionChange = () => {
          if (socketRef.current && editorRef.current) {
            const cursorOffset = getCursorOffset();
            emitCursorEvent(socketRef.current, cursorOffset, clientId);
          }
        };
        document.addEventListener("selectionchange", handleSelectionChange);

        resolve();
        return () => {
          cleanup();
          document.removeEventListener("selectionchange", handleSelectionChange);
        };
      });

      socketRef.current?.on("error", (msg) => {
        setError(msg);
        if (msg === "Invalid Password" || msg === "Private Session") {
          setRequiresPassword(true);
        } else {
          setRequiresPassword(false);
        }
        socketRef.current?.disconnect();
        reject(msg);
      });

      socketRef.current?.on("isCreator", (isCreator: boolean) => {
        if (isCreator) setRequiresPassword(false);
      });

      socketRef.current?.on("sessionType", (type: { isPublic: boolean }) => {
        if (!type.isPublic && !isPrivate && !password) setRequiresPassword(true);
      });

      socketRef.current?.on("disconnect", () => {
        setIsConnected(false);
      });
    });
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const attemptConnection = async () => {
      try {
        if (isPrivate && password) {
          cleanup = await connectSocket(password);
        } else {
          cleanup = await connectSocket();
        }
      } catch (err) {
        console.log("Connection failed:", err);
      }
    };

    attemptConnection();

    return () => {
      if (cleanup) cleanup();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [sessionId, isPrivate, password]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword) {
      setError("Password is required");
      return;
    }
    setError(null);
    try {
      await connectSocket(inputPassword);
      setRequiresPassword(false);
    } catch (err) {
      console.log("Password attempt failed:", err);
    }
  };

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
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return 0;
    }
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    try {
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    } catch (err) {
      console.warn("Failed to calculate cursor offset:", err);
      return 0;
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4">
        {requiresPassword ? (
          <>
            <h2>Enter Password for {sessionId}</h2>
            {error && <p className="text-red-500">{error}</p>}
            <form onSubmit={handlePasswordSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="outline border-1 p-1 rounded-2xl"
                placeholder="Password"
              />
              <button type="submit" className="outline border-1 rounded-2xl p-2">
                Join
              </button>
            </form>
          </>
        ) : (
          <p>Loading session {sessionId}...</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p>Users: {userCount}</p>
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