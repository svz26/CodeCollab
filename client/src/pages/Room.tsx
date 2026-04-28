import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, Video, Copy } from "lucide-react";
import { io, Socket } from "socket.io-client";
import Editor from "@monaco-editor/react";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const Room = () => {
  const { roomId } = useParams();

  const socketRef = useRef<Socket | null>(null);
  const editorRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRemoteUpdateRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);
  const [participants, setParticipants] = useState<
    Array<{ socketId: string; userId: string }>
  >([]);

  const getStoredUserId = () => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return "Guest";
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      return parsedUser?.id || parsedUser?.email || parsedUser?.name || "Guest";
    } catch {
      return storedUser;
    }
  };

  const handleCopy = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      alert("Room ID copied!");
    }
  };

  /* =============================
     🎥 Local Video Setup
  ============================= */
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    startVideo();
  }, []);

  /* =============================
     🔌 Socket + Code Sync Setup
  ============================= */
  useEffect(() => {
    if (!roomId) return;

    // Connect to backend
    socketRef.current = io(SOCKET_URL, {
      auth: { token: localStorage.getItem("token") },
    });

    const handleConnect = () => {
      console.log("Connected to server:", socketRef.current?.id);

      // Join room after connection
      socketRef.current?.emit("join-room", {
        roomId,
        userId: getStoredUserId(),
      });
      console.log("Joined room:", roomId);
    };

    // Receive code updates from server
    const handleCodeChange = (data: { roomId: string; code: string }) => {
      console.log("Received code change:", data.code);
      if (editorRef.current && editorRef.current.getValue() !== data.code) {
        isRemoteUpdateRef.current = true;
        editorRef.current.setValue(data.code);
      }
    };

    const handleLoadCode = (code: string) => {
      if (!editorRef.current) {
        pendingCodeRef.current = code;
        return;
      }

      if (editorRef.current.getValue() !== code) {
        isRemoteUpdateRef.current = true;
        editorRef.current.setValue(code);
      }
    };

    const handleParticipantsUpdate = (
      users: Array<{ socketId: string; userId: string }>
    ) => {
      setParticipants(users);
    };

    socketRef.current.on("connect", handleConnect);
    socketRef.current.on("code-change", handleCodeChange);
    socketRef.current.on("load-code", handleLoadCode);
    socketRef.current.on("participants-update", handleParticipantsUpdate);

    if (socketRef.current.connected) {
      handleConnect();
    }

    return () => {
      socketRef.current?.off("connect", handleConnect);
      socketRef.current?.off("code-change", handleCodeChange);
      socketRef.current?.off("load-code", handleLoadCode);
      socketRef.current?.off("participants-update", handleParticipantsUpdate);
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-lg">
        <div>
          <h1 className="text-lg font-semibold">CodeCollab Room</h1>
          <p className="text-xs text-slate-400">Room ID: {roomId}</p>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
        >
          <Copy size={16} />
          Copy ID
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 bg-slate-900 border-r border-slate-800 p-4">
          <div className="h-full rounded-xl border border-slate-700 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              defaultValue=""
              theme="vs-dark"
              onMount={(editor) => {
                editorRef.current = editor;

                if (
                  pendingCodeRef.current !== null &&
                  editor.getValue() !== pendingCodeRef.current
                ) {
                  isRemoteUpdateRef.current = true;
                  editor.setValue(pendingCodeRef.current);
                }
                pendingCodeRef.current = null;

                // Emit code changes on typing
                editor.onDidChangeModelContent(() => {
                  if (isRemoteUpdateRef.current) {
                    isRemoteUpdateRef.current = false;
                    return;
                  }

                  const value = editor.getValue();
                  console.log("Emitting code change:", value);

                  socketRef.current?.emit("code-change", {
                    roomId,
                    code: value,
                  });
                });
              }}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:flex flex-col w-80 bg-slate-950 border-l border-slate-800 p-4 space-y-6">
          {/* Participants */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} />
              <h2 className="font-semibold">Participants</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              {participants.length > 0 ? (
                participants.map((user) => (
                  <div
                    key={user.socketId}
                    className="bg-slate-800 px-3 py-2 rounded-lg"
                  >
                    {user.userId}
                  </div>
                ))
              ) : (
                <div className="bg-slate-800 px-3 py-2 rounded-lg">
                  Waiting for participants...
                </div>
              )}
            </div>
          </div>

          {/* Video Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Video size={18} />
              <h2 className="font-semibold">Video Call</h2>
            </div>

            <div className="bg-slate-800 rounded-xl h-40 flex items-center justify-center border border-slate-700 overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;