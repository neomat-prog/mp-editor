import { useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSocket } from "../utils/useSocket";
import { EditorProps } from "../utils/types";

const Editor = ({ sessionId }: EditorProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const { isPrivate, password } = location.state || {};

  const {
    isConnected,
    userCount,
    userId,
    requiresPassword,
    error,
    inputPassword,
    connectSocket,
    handleEdit,
    setError,
    setInputPassword,
  } = useSocket({ sessionId, isPrivate, password, editorRef: editorRef as React.RefObject<HTMLDivElement> });

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

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    handleEdit(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertParagraph");
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
    <div className="p-4">
      <p>Users: {userCount}</p>
      <p>User ID: {userId || "Waiting for ID..."}</p>
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