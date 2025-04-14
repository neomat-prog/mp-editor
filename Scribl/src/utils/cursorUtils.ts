export const getCursorOffset = (editorRef: React.RefObject<HTMLDivElement>): number => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return 0;
    }
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    try {
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    } catch (err) {
      console.warn("Failed to calculate cursor offset:", err);
      return 0;
    }
  };