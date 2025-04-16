interface File {
    fileId: string;
    fileName: string;
  }
  
  interface EditorTabsProps {
    files: File[];
    currentFileId: string;
    onSwitchFile: (fileId: string) => void;
  }
  
  const EditorTabs = ({ files, currentFileId, onSwitchFile }: EditorTabsProps) => {
    return (
      <div className="flex bg-vscode-tabs-bg border-b border-vscode-border">
        {files.map(({ fileId, fileName }) => (
          <button
            key={fileId}
            onClick={() => onSwitchFile(fileId)}
            className={`px-4 py-2 text-vscode-text border-r border-vscode-border ${
              fileId === currentFileId
                ? "bg-vscode-editor-bg border-t-2 border-t-vscode-blue"
                : "bg-vscode-tabs-bg hover:bg-vscode-tabs-hover"
            }`}
          >
            {fileName}
          </button>
        ))}
      </div>
    );
  };
  
  export default EditorTabs;