

interface SidebarProps {
  onCreateFile: () => void;
  onSwitchFile: (fileId: string) => void;
  files: { fileId: string; fileName: string }[];
}

const Sidebar = ({ onCreateFile, files, onSwitchFile }: SidebarProps) => {
  return (
    <div className="w-64 bg-vscode-sidebar-bg border-r border-vscode-border flex flex-col">
      <div className="flex flex-col items-start p-2">
        <div className="flex gap-2 mb-2">
          <button
            onClick={onCreateFile}
            className="p-2 text-vscode-text hover:bg-vscode-sidebar-hover rounded"
            title="New File"
          >
            📄
          </button>
          <button
            onClick={() => {}}
            className="p-2 text-vscode-text hover:bg-vscode-sidebar-hover rounded"
            title="New Folder"
          >
            📁
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="text-vscode-text mr-[20px]">
          {files.map(({ fileId, fileName }) => (
            <li
              key={fileId}
              className="px-3 py-1 hover:bg-vscode-sidebar-hover cursor-pointer flex items-center"
              onClick={() => onSwitchFile(fileId)}
            >
              <span className="mr-2">📄</span>
              <span className="truncate">{fileName}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;