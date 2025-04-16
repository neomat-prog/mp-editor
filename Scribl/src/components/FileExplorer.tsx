interface File {
    fileId: string;
    fileName: string;
  }
  
  interface FileExplorerProps {
    files: File[];
    onSwitchFile: (fileId: string) => void;
  }
  
  const FileExplorer = ({ files, onSwitchFile }: FileExplorerProps) => {
    return (
      <div className="bg-vscode-explorer-bg border-b border-vscode-border p-2">
        <h3 className="text-xs font-semibold text-vscode-text-secondary uppercase mb-1">
          Explorer
        </h3>
        
      </div>
    );
  };
  
  export default FileExplorer;