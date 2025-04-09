import { useEffect, useRef, useState } from "react";

const Editor = () => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [placeholder, setPlaceholder] = useState(true);

  const handleInput = () => {
    const content = editorRef.current ? editorRef.current.textContent : "";
    setPlaceholder(!content);
  };

const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Enter") {
        e.preventDefault();
        document.execCommand("insertParagraph");
    }
};

  useEffect(() => {
    if (placeholder) {
      if (editorRef.current) {
        editorRef.current.textContent = "";
      }
    }
  }, [placeholder]);

  return (
    <div
      ref={editorRef}
      className="h-screen w-screen p-8 text-lg outline-none overflow-auto bg-white"
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder="Start typing here..."
      suppressContentEditableWarning={true}
    />
  );
};

export default Editor;
