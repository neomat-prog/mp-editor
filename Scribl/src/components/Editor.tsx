import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSocket } from "../utils/useSocket";
import { EditorProps } from "../utils/types";
import { debounce } from "lodash";
import EditorContent from "./EditorContent";
import FileExplorer from "./FileExplorer";
import EditorTabs from "./EditorTabs";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

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
      <div className="flex h-screen items-center justify-center bg-vscode-bg-dark p-4">
        {requiresPassword ? (
          <div className="rounded-lg bg-vscode-panel p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-vscode-text">
              Enter Password for {sessionId}
            </h2>
            {error && <p className="mb-2 text-vscode-error">{error}</p>}
            <form onSubmit={handlePasswordSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                className="rounded-md border border-vscode-border bg-vscode-input p-2 text-vscode-text placeholder-vscode-text-secondary focus:outline-none focus:ring-1 focus:ring-vscode-blue"
                placeholder="Password"
              />
              <button
                type="submit"
                className="rounded-md bg-vscode-blue px-4 py-2 text-vscode-text hover:bg-vscode-blue-hover"
              >
                Join
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center text-vscode-text">
            <p>Loading session {sessionId}...</p>
            {error && (
              <div className="mt-4">
                <p className="text-vscode-error">{error}</p>
                {error !== "Too many connections" ? (
                  <button
                    onClick={handleRetry}
                    className="mt-2 rounded-md bg-vscode-blue px-4 py-2 text-vscode-text hover:bg-vscode-blue-hover"
                  >
                    Retry Connection
                  </button>
                ) : (
                  <p className="mt-2 text-vscode-text-secondary">
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
    <div className="flex h-screen flex-col bg-vscode-bg-dark text-vscode-text">
      <TopBar userCount={userCount} onCreateSession={debouncedCreateSession} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onCreateFile={handleCreateFile} files={files} onSwitchFile={handleSwitchFile} />
        <div className="flex flex-1 flex-col">
          {/* <FileExplorer files={files} onSwitchFile={handleSwitchFile} /> */}
          <EditorTabs
            files={files}
            currentFileId={currentFileId}
            onSwitchFile={handleSwitchFile}
          />
          {error && (
            <p className="p-2 text-vscode-error bg-vscode-error-bg">{error}</p>
          )}
          <div className="flex-1 overflow-auto bg-vscode-editor-bg">
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
        </div>
      </div>
    </div>
  );
};

export default Editor;