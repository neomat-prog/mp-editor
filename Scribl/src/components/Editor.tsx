import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSocket } from "../utils/useSocket";
import { EditorProps } from "../utils/types";
import { debounce } from "lodash";
import EditorContent from "./EditorContent";

const Editor = ({ sessionId }: EditorProps) => {
  const location = useLocation();
  const { isPrivate, password } = location.state || {};
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetry, setLastRetry] = useState(0);
  const [isSwitchingFile, setIsSwitchingFile] = useState(false);
  const [contents, setContents] = useState<{ [fileId: string]: string }>({
    default: "",
  });

  const {
    isConnected,
    userCount,
    requiresPassword,
    error,
    inputPassword,
    connectSocket,
    handleEdit,
    setError,
    setInputPassword,
    createFile,
    files,
    currentFileId,
    switchFile,
  } = useSocket({
    sessionId,
    isPrivate,
    password,
    userId: Math.random().toString(36).substring(2, 8),
    setIsSwitchingFile,
    setContent: (fileId: string, content: string) =>
      setContents((prev) => ({ ...prev, [fileId]: content })),
  });

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword) {
      setError("Password is required");
      return;
    }
    setError(null);
    try {
      await connectSocket(inputPassword);
    } catch (err) {
      console.log("Password attempt failed:", err);
    }
  };

  const handleCreateFile = () => {
    setIsSwitchingFile(true);
    createFile();
  };

  const handleSwitchFile = (fileId: string) => {
    console.log(`Tab clicked: ${fileId}, current: ${currentFileId}`);
    switchFile(fileId);
  };

  const handleRetry = async () => {
    const now = Date.now();
    if (now - lastRetry < 5000) {
      console.log("Retry throttled, please wait");
      return;
    }
    setError(null);
    setRetryCount((prev) => prev + 1);
    setLastRetry(now);
    try {
      await connectSocket(isPrivate ? password : undefined);
    } catch (err) {
      console.log("Retry failed:", err);
    }
  };

  const debouncedCreateSession = debounce(() => {
    console.log("Creating public session");
    const newSessionId = Math.random().toString(36).substring(2, 8);
    window.location.href = `/${newSessionId}`;
  }, 1000);

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
              <button
                type="submit"
                className="outline border-1 rounded-2xl p-2"
              >
                Join
              </button>
            </form>
          </>
        ) : (
          <div>
            <p>Loading session {sessionId}...</p>
            {error && (
              <div>
                <p className="text-red-500">{error}</p>
                {error !== "Too many connections" ? (
                  <button
                    onClick={handleRetry}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Retry Connection
                  </button>
                ) : (
                  <p className="text-gray-500">
                    Please wait 30 seconds before retrying
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <p>Users: {userCount}</p>
      {error && <p className="text-red-500">{error}</p>}
      <button
        onClick={debouncedCreateSession}
        className="mb-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Create Public Session
      </button>
      <button
        onClick={handleCreateFile}
        className="mb-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        New File
      </button>
      <div className="mb-4 flex gap-2">
        {files.map(({ fileId, fileName }) => (
          <button
            key={fileId}
            onClick={() => handleSwitchFile(fileId)}
            className={`px-4 py-2 rounded ${
              fileId === currentFileId
                ? "bg-gray-300"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {fileName}
          </button>
        ))}
      </div>
      <EditorContent
        currentFileId={currentFileId}
        content={contents[currentFileId] || ""}
        setContent={(content: string) =>
          setContents((prev) => ({ ...prev, [currentFileId]: content }))
        }
        handleEdit={handleEdit}
        isSwitchingFile={isSwitchingFile}
      />
    </div>
  );
};

export default Editor;