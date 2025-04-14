import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection } from "../sockets/socket";
import {
  setupSocketEvents,
  emitEditEvent,
  emitCursorEvent,
} from "../sockets/socketEvents";
import { SocketState } from "./types";

interface UseSocketProps {
  sessionId: string;
  isPrivate?: boolean;
  password?: string;
  userId: string;
  editorRef: React.RefObject<HTMLDivElement>;
}

export const useSocket = ({
  sessionId,
  isPrivate,
  password,
  editorRef,
}: UseSocketProps) => {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    userCount: 0,
    requiresPassword: false,
    error: null,
    inputPassword: "",
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [isLocalChange, setIsLocalChange] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const clientId = Math.random().toString(36).substring(2, 8);

  const setIsConnected = (value: boolean) =>
    setState((prev) => ({ ...prev, isConnected: value }));
  const setUserCount = (count: number) =>
    setState((prev) => ({ ...prev, userCount: count }));
  const setRequiresPassword = (value: boolean) =>
    setState((prev) => ({ ...prev, requiresPassword: value }));
  const setError = (error: string | null) =>
    setState((prev) => ({ ...prev, error }));

  const connectSocket = (pwd?: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = createSocketConnection(sessionId, isPrivate, pwd);

    return new Promise<() => void>((resolve, reject) => {
      socketRef.current?.on("connect", () => {
        console.log("Emitting setUserId:", userId);
        setIsConnected(true);
        const storedUserId = localStorage.getItem("userId");
        if (storedUserId) {
            console.log(`Sending stored userId: ${storedUserId}`);
            socketRef.current?.emit("setUserId", { userId: storedUserId, isCreator: isPrivate && !!pwd });
          }
        socketRef.current?.emit("setUserId", {
          userId,
          isCreator: isPrivate && !!pwd,
        });
        const cleanup = setupSocketEvents({
          socket: socketRef.current!,
          editorRef,
          isLocalChange,
          setIsLocalChange,
          setIsConnected,
          clientId,
          setUserCount,
        });
        socketRef.current?.on("setUserId", ({ userId }: { userId: string }) => {
          console.log(`Received userId from server: ${userId}`);
          setUserId(userId);
          localStorage.setItem("userId", userId);
          socketRef.current?.emit("setCreator", {
            isCreator: isPrivate && !!pwd,
          });
        });

        const handleSelectionChange = () => {
          if (socketRef.current && editorRef.current) {
            const cursorOffset = getCursorOffset(editorRef);
            emitCursorEvent(socketRef.current, cursorOffset, clientId);
          }
        };
        document.addEventListener("selectionchange", handleSelectionChange);

        resolve(() => {
          cleanup();
          document.removeEventListener(
            "selectionchange",
            handleSelectionChange
          );
        });
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
        if (!type.isPublic && !isPrivate && !pwd) setRequiresPassword(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isPrivate, password]);

  const handleEdit = (content: string) => {
    setIsLocalChange(true);
    if (socketRef.current) {
      const cursorOffset = getCursorOffset(editorRef);
      emitEditEvent(socketRef.current, content, cursorOffset, clientId);
    }
  };

  return {
    ...state,
    userId,
    socket: socketRef.current,
    connectSocket,
    handleEdit,
    setError,
    setInputPassword: (pwd: string) =>
      setState((prev) => ({ ...prev, inputPassword: pwd })),
    inputPassword: state.inputPassword || "",
  };
};

function getCursorOffset(editorRef: React.RefObject<HTMLDivElement>): number {
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
}
