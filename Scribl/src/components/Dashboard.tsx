import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  function generateRandomString() {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";

    let result = "";

    for (let i = 0; i < 6; i++) {
      const randomChoice = Math.random() > 0.5 ? chars : digits; // 50% chance to pick letters or digits
      const randomChar =
        randomChoice[Math.floor(Math.random() * randomChoice.length)];
      result += randomChar;
    }

    return result;
  }

  const handleCreateSession = () => {
    const sessionId = generateRandomString();
    navigate(`/${sessionId}`);
  };

  return (
    <div className="p-4 flex">
      <button
        className="outline border-3  rounded-2xl p-4"
        onClick={handleCreateSession}
      >
        Create a Session
      </button>
    </div>
  );
};

export default Dashboard;
