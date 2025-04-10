import { BrowserRouter as Router, Route, Routes, useParams } from "react-router-dom";
import Editor from "./components/Editor";

const EditorWrapper = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Editor sessionId={sessionId || "default"} />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/:sessionId" element={<EditorWrapper />} />
        <Route path="/" element={<Editor sessionId="default" />} />
      </Routes>
    </Router>
  );
};

export default App;