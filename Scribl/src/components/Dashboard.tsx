import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [password, setPassword] = useState("");
  const [sessionName, setSessionName] = useState("");
  const navigate = useNavigate();

  function generateRandomString() {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      const randomChoice = Math.random() > 0.5 ? chars : digits;
      const randomChar =
        randomChoice[Math.floor(Math.random() * randomChoice.length)];
      result += randomChar;
    }
    return result;
  }

  const handleCreatePublicSession = () => {
    const sessionId = generateRandomString();
    navigate(`/${sessionId}`);
  };

  const handleCreatePrivateSession = () => {
    if (!sessionName || !password) {
      alert("Please enter a session name and password");
      return;
    }
    navigate(`/${sessionName}`, { state: { isPrivate: true, password } });
  };

  return (
    <div className="p-4 flex gap-5">
      <button
        className="outline border-1 rounded-2xl p-4"
        onClick={handleCreatePublicSession}
      >
        Create a Public Session
      </button>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          className="outline border-1 p-1 rounded-2xl"
          placeholder="Session Name"
        />
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="outline border-1 p-1 rounded-2xl"
          placeholder="Password"
        />
        <button
          className="outline border-1 rounded-2xl p-4"
          onClick={handleCreatePrivateSession}
        >
          Create a Private Session
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
