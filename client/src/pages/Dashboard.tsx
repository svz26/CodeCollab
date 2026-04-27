import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { LogOut, Plus, LogIn } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Dashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  const handleCreateRoom = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/rooms/create`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const roomId = response.data?.roomId;
      if (!roomId) throw new Error("Room ID not returned");

      navigate(`/room/${roomId}`);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        "Could not create room. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      setError("Please enter a Room ID");
      return;
    }

    navigate(`/room/${joinRoomId.trim()}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-lg">
        <h1 className="text-xl font-semibold tracking-tight">
          CodeCollab
        </h1>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">

        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">
            Welcome Back 👋
          </h2>
          <p className="text-slate-400">
            Start or join a collaborative coding session.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 text-sm text-red-300 bg-red-900/40 border border-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">

          {/* Create Room Card */}
          <div className="bg-slate-800/60 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Create a New Room
              </h3>
              <p className="text-sm text-slate-400">
                Invite others and start coding in real time.
              </p>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all duration-200 font-semibold disabled:opacity-60"
            >
              <Plus size={18} />
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>

          {/* Join Room Card */}
          <div className="bg-slate-800/60 backdrop-blur-lg border border-slate-700 rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Join Existing Room
              </h3>
              <p className="text-sm text-slate-400">
                Enter a Room ID to join your team.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 focus:border-indigo-500 outline-none"
              />

              <button
                onClick={handleJoinRoom}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 active:scale-[0.98] transition-all duration-200 font-semibold"
              >
                <LogIn size={18} />
                Join Room
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
