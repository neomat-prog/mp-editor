interface TopBarProps {
    userCount: number;
    onCreateSession: () => void;
  }
  
  const TopBar = ({ userCount, onCreateSession }: TopBarProps) => {
    return (
      <div className="bg-vscode-titlebar-bg text-vscode-text flex items-center justify-between px-4 py-1 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <span className="text-sm">Collaborative Editor</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">Users: {userCount}</span>
          <button
            onClick={onCreateSession}
            className="text-sm bg-vscode-blue px-2 py-1 rounded hover:bg-vscode-blue-hover"
          >
            New Session
          </button>
        </div>
      </div>
    );
  };
  
  export default TopBar;