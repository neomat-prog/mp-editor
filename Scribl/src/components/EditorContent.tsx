import { useRef, useEffect, useState } from "react";

interface EditorContentProps {
  currentFileId: string;
  content: string;
  setContent: (content: string) => void;
  handleEdit: (content: string) => void;
  isSwitchingFile: boolean;
}

const EditorContent = ({
  currentFileId,
  content,
  setContent,
  handleEdit,
  isSwitchingFile,
}: EditorContentProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [cursors, setCursors] = useState<Record<string, { offset: number; userId: string }>>({});

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content || "";
      if (!isSwitchingFile) {
        editorRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [currentFileId, content, isSwitchingFile]);

  useEffect(() => {
    // Render cursors (basic implementation)
    const renderCursors = () => {
      if (!editorRef.current) return;
      const existingCursors = editorRef.current.querySelectorAll(".remote-cursor");
      existingCursors.forEach((cursor) => cursor.remove());
      Object.entries(cursors).forEach(([socketId, { offset, userId }]) => {
        try {
          const range = document.createRange();
          let currentOffset = 0;
          let targetNode = editorRef.current;
          const walkNodes = (node: Node) => {
            if (currentOffset >= offset) return true;
            if (node.nodeType === Node.TEXT_NODE) {
              const length = (node.textContent || "").length;
              if (currentOffset + length >= offset) {
                range.setStart(node, offset - currentOffset);
                range.setEnd(node, offset - currentOffset);
                return true;
              }
              currentOffset += length;
            } else {
              for (const child of node.childNodes) {
                if (walkNodes(child)) return true;
              }
            }
            return false;
          };
          walkNodes(targetNode!);
          const cursor = document.createElement("span");
          cursor.className = "remote-cursor";
          cursor.style.borderLeft = "2px solid red";
          cursor.style.height = "1em";
          cursor.style.display = "inline-block";
          cursor.title = `User: ${userId}`;
          range.insertNode(cursor);
        } catch (err) {
          console.warn(`Failed to render cursor for ${userId}:`, err);
        }
      });
    };
    renderCursors();
  }, [cursors, content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    console.log(`Input in file ${currentFileId}:`, newContent.slice(0, 50));
    setContent(newContent);
    handleEdit(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const br = document.createElement("br");
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
        const newContent = editorRef.current?.innerHTML || "";
        console.log(`Enter pressed in file ${currentFileId}, new content:`, newContent.slice(0, 50));
        setContent(newContent);
        handleEdit(newContent);
      }
    }
  };

  return (
    <div
      className="relative"
      style={{ opacity: isSwitchingFile ? 0.5 : 1, transition: "opacity 0.2s" }}
    >
      {isSwitchingFile && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">Switching file...</p>
        </div>
      )}
      <div
        ref={editorRef}
        className="h-screen w-screen p-8 text-lg outline-none overflow-auto bg-white relative"
        style={{ direction: "ltr", textAlign: "left" }}
        contentEditable={!isSwitchingFile}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder="Start typing here..."
        suppressContentEditableWarning={true}
      />
    </div>
  );
};

export default EditorContent;