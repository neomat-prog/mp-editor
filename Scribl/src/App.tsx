import {
  BrowserRouter as Router,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import Editor from "./components/Editor";
import Dashboard from "./components/Dashboard";

const EditorWrapper = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Editor sessionId={sessionId || "default"} />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/:sessionId" element={<EditorWrapper />} />
      </Routes>
    </Router>
  );
};

export default App;
