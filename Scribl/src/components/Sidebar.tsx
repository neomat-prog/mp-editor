import { PlusIcon } from "@heroicons/react/24/outline";

interface SidebarProps {
  onCreateFile: () => void;
  onSwitchFile: (fileId: string) => void;
  files: { fileId: string; fileName: string }[];
}

const Sidebar = ({ onCreateFile, files, onSwitchFile }: SidebarProps) => {
  return (
    <div className="w-[120px] bg-vscode-sidebar-bg border-r border-vscode-border flex flex-col items-center py-2">
      <div className="flex">
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
          title="New File"
        >
          📁
        </button>
      </div>
      <div className="text-center mr-[20px] hover:bg-gray-500">
        <ul className="bg-white">
          {files.map(({ fileId, fileName }) => (
            <li
              key={fileId}
              className="text-vscode-text hover:bg-vscode-sidebar-hover cursor-pointer list-none rounded px-2 py-1"
              onClick={() => onSwitchFile(fileId)}
            >
              {fileName}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
