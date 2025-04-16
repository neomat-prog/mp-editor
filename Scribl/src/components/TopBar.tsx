interface TopBarProps {
  userCount: number;
  onCreateSession: () => void;
}

const TopBar = ({ userCount, onCreateSession }: TopBarProps) => {
  return (
    <div className="bg-gradient-to-r from-vscode-titlebar-bg-dark to-vscode-titlebar-bg-light text-vscode-text flex items-center justify-between px-6 py-2 shadow-md border-b border-vscode-border">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide">
          VSCODE ONLINE
        </span>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-sm font-medium">Users: {userCount}</span>
        <button
          onClick={onCreateSession}
          className="text-sm font-medium bg-vscode-blue px-3 py-1.5 rounded-md hover:bg-vscode-blue-hover transition-colors duration-200 border-none shadow-sm"
        >
          New Session
        </button>
      </div>
    </div>
  );
};

export default TopBar;
