import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection } from "../sockets/socket";
import {
  setupSocketEvents,
  emitEditEvent,
  emitCursorEvent,
} from "../sockets/socketEvents";
import { SocketState } from "./types";
import { throttle } from "lodash";

interface UseSocketProps {
  sessionId: string;
  isPrivate?: boolean;
  password?: string;
  userId: string;
  setIsSwitchingFile: (value: boolean) => void;
  setContent: (fileId: string, content: string) => void;
}

interface File {
  fileId: string;
  fileName: string;
}

export const useSocket = ({
  sessionId,
  isPrivate,
  password,
  userId: propUserId,
  setIsSwitchingFile,
  setContent,
}: UseSocketProps) => {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    userCount: 0,
    requiresPassword: false,
    error: null,
    inputPassword: "",
  });
  const [userId, setUserId] = useState<string | null>(
    localStorage.getItem("userId") || propUserId
  );
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [files, setFiles] = useState<File[]>([
    { fileId: "default", fileName: "untitled.txt" },
  ]);
  const [currentFileId, setCurrentFileId] = useState<string>("default");
  const socketRef = useRef<Socket | null>(null);
  const clientId = Math.random().toString(36).substring(2, 8);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnecting = useRef(false);
  const connectionTimeout = 10000;
  const retryPause = useRef(false);

  const setIsConnected = useCallback(
    (value: boolean) =>
      setState((prev) => ({ ...prev, isConnected: value })),
    []
  );
  const setUserCount = useCallback(
    (count: number) => setState((prev) => ({ ...prev, userCount: count })),
    []
  );
  const setRequiresPassword = useCallback(
    (value: boolean) =>
      setState((prev) => ({ ...prev, requiresPassword: value })),
    []
  );
  const setError = useCallback(
    (error: string | null) => setState((prev) => ({ ...prev, error })),
    []
  );
  const setInputPassword = useCallback(
    (pwd: string) => setState((prev) => ({ ...prev, inputPassword: pwd })),
    []
  );

  const connectSocket = useCallback(
    (pwd?: string) => {
      if (isConnecting.current || socketRef.current?.connected) {
        console.log(`Connection skipped: already connecting or connected for session ${sessionId}`);
        return Promise.resolve(() => {});
      }

      if (retryPause.current) {
        console.log(`Connection paused due to rate limit for session ${sessionId}`);
        return Promise.reject("Rate limit exceeded, please wait");
      }

      isConnecting.current = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      socketRef.current = createSocketConnection(sessionId, isPrivate, pwd);

      return new Promise<() => void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`Connection timeout for session ${sessionId}`);
          setError("Connection timed out");
          isConnecting.current = false;
          retryPause.current = true;
          setTimeout(() => (retryPause.current = false), 30000);
          socketRef.current?.disconnect();
          reject("Connection timed out");
        }, connectionTimeout);

        socketRef.current?.on("connect", () => {
          console.log(`Socket connected for session ${sessionId}`);
          clearTimeout(timeout);
          reconnectAttempts.current = 0;
          retryPause.current = false;
          setIsConnected(true);
          isConnecting.current = false;
          const effectiveUserId = localStorage.getItem("userId") || propUserId;
          socketRef.current?.emit("setUserId", {
            userId: effectiveUserId,
            isCreator: isPrivate && !!pwd,
          });
          socketRef.current?.emit("getFiles");
        });

        socketRef.current?.on("setUserId", ({ userId }: { userId: string }) => {
          console.log(`Received userId from server: ${userId}`);
          setUserId(userId);
          localStorage.setItem("userId", userId);
          socketRef.current?.emit("setCreator", {
            isCreator: isPrivate && !!pwd,
          });
        });

        socketRef.current?.on(
          "fileCreated",
          ({ fileId, fileName, creatorId }: { fileId: string; fileName: string; creatorId: string }) => {
            console.log(`New file created: ${fileName} (${fileId}) by user ${creatorId}`);
            setFiles((prev) => {
              if (prev.some((f) => f.fileId === fileId)) return prev;
              console.log(`Adding file ${fileName} to files list`);
              return [...prev, { fileId, fileName }];
            });
            if (socketRef.current && userId === creatorId) {
              console.log(`Creator ${userId} auto-switching to new file ${fileId}`);
              socketRef.current.emit("switchFile", { fileId });
              setIsSwitchingFile(true);
            } else {
              console.log(`User ${userId} staying on file ${currentFileId}`);
            }
          }
        );

        socketRef.current?.on(
          "files",
          ({ files }: { files: { fileId: string; fileName: string }[] }) => {
            console.log(
              `Received files: ${files.map((f) => f.fileName).join(", ")}`
            );
            setFiles(
              files.length
                ? files
                : [{ fileId: "default", fileName: "untitled.txt" }]
            );
          }
        );

        socketRef.current?.on(
          "switchFile",
          ({ fileId, content }: { fileId: string; content: string }) => {
            console.log(`Switched to file: ${fileId} with content:`, content.slice(0, 50));
            setCurrentFileId(fileId);
            setContent(fileId, content || "");
            setIsLocalChange(false);
            setIsSwitchingFile(false);
          }
        );

        const cleanup = setupSocketEvents({
          socket: socketRef.current!,
          isLocalChange,
          setIsLocalChange,
          setIsConnected,
          clientId,
          setUserCount,
          currentFileId,
          setContent,
        });

        const handleSelectionChange = () => {
          if (socketRef.current) {
            const cursorOffset = getCursorOffset();
            emitCursorEvent(socketRef.current, cursorOffset, clientId, currentFileId);
          }
        };
        document.addEventListener("selectionchange", handleSelectionChange);

        socketRef.current?.on("error", (msg) => {
          console.log(`Socket error: ${msg}`);
          clearTimeout(timeout);
          setError(msg);
          isConnecting.current = false;
          setIsSwitchingFile(false);
          if (msg === "Too many connections") {
            retryPause.current = true;
            setTimeout(() => (retryPause.current = false), 30000);
          }
          if (msg === "Invalid Password" || msg === "Private Session") {
            setRequiresPassword(true);
          }
          socketRef.current?.disconnect();
          reject(msg);
        });

        socketRef.current?.on("disconnect", () => {
          console.log(`Socket disconnected for session ${sessionId}`);
          clearTimeout(timeout);
          setIsConnected(false);
          isConnecting.current = false;
          setIsSwitchingFile(false);
          if (!retryPause.current && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            console.log(
              `Reconnect attempt ${reconnectAttempts.current} for session ${sessionId} after ${delay}ms`
            );
            setTimeout(() => connectSocket(pwd), delay);
          } else if (retryPause.current) {
            console.log(`Reconnect paused due to rate limit for session ${sessionId}`);
          } else {
            console.warn(`Max reconnect attempts reached for session ${sessionId}`);
            setError("Connection failed after multiple attempts");
            reject("Max reconnect attempts reached");
          }
        });

        socketRef.current?.on("isCreator", (isCreator: boolean) => {
          if (isCreator) setRequiresPassword(false);
        });

        socketRef.current?.on("sessionType", (type: { isPublic: boolean }) => {
          if (!type.isPublic && !isPrivate && !pwd) setRequiresPassword(true);
        });

        resolve(() => {
          clearTimeout(timeout);
          cleanup();
          document.removeEventListener("selectionchange", handleSelectionChange);
          socketRef.current?.off("fileCreated");
          socketRef.current?.off("files");
          socketRef.current?.off("switchFile");
          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
          }
        });
      });
    },
    [
      sessionId,
      isPrivate,
      propUserId,
      clientId,
      currentFileId,
      setIsConnected,
      setUserCount,
      setError,
      setRequiresPassword,
      setIsSwitchingFile,
      setContent,
    ]
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    const attemptConnection = async () => {
      console.log(`Attempting connection for session ${sessionId}`);
      try {
        if (isMounted) {
          cleanup = await connectSocket(isPrivate ? password : undefined);
        }
      } catch (err) {
        console.log(`Connection failed for session ${sessionId}:`, err);
      }
    };

    attemptConnection();

    return () => {
      isMounted = false;
      console.log(`Cleaning up socket for session ${sessionId}`);
      if (cleanup) cleanup();
    };
  }, [connectSocket, isPrivate, password]);

  const throttledHandleEdit = useCallback(
    throttle((content: string) => {
      setIsLocalChange(true);
      if (socketRef.current) {
        const cursorOffset = getCursorOffset();
        console.log(`Emitting edit for file ${currentFileId}:`, content.slice(0, 50));
        emitEditEvent(socketRef.current, content, cursorOffset, clientId, currentFileId);
      }
    }, 50),
    [clientId, currentFileId]
  );

  const handleEdit = useCallback(
    (content: string) => {
      throttledHandleEdit(content);
    },
    [throttledHandleEdit]
  );

  const createFile = useCallback(() => {
    if (socketRef.current) {
      console.log(`Creating new file for session ${sessionId}`);
      socketRef.current.emit("createFile");
    }
  }, []);

  const switchFile = useCallback(
    (fileId: string) => {
      if (socketRef.current && fileId !== currentFileId) {
        console.log(`Switching to file ${fileId} from ${currentFileId}`);
        socketRef.current.emit("switchFile", { fileId });
        setIsSwitchingFile(true);
      } else {
        console.log(`Switch to file ${fileId} skipped: same as current or no socket`);
      }
    },
    [currentFileId, setIsSwitchingFile]
  );

  return {
    ...state,
    userId,
    socket: socketRef.current,
    connectSocket,
    handleEdit,
    setError,
    setInputPassword,
    inputPassword: state.inputPassword || "",
    createFile,
    files,
    currentFileId,
    switchFile,
  };
};

function getCursorOffset(): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return 0;
  }
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  try {
    preCaretRange.selectNodeContents(document);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  } catch (err) {
    console.warn("Failed to calculate cursor offset:", err);
    return 0;
  }
}