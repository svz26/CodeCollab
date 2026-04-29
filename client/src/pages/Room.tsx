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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isRemoteUpdateRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  type Participant = {
    socketId: string;
    userId: string;
    name: string;
  };
  const [participants, setParticipants] = useState<Participant[]>([]);
  // ADD these two after the existing participants useState
  type ChatMessage = {
    userId: string;
    name: string;
    message: string;
    timestamp: Date;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const getUser = () => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return { id: "guest", name: "Guest" };
    try {
      const user = JSON.parse(storedUser);
      return {
        id: user.id || user._id || "guest",
        name: user.name || user.email || "Guest",
      };
    } catch {
      return { id: "guest", name: storedUser };
    }
  };

  const handleCopy = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      alert("Room ID copied!");
    }
  };
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const user = getUser();
    console.log("Sending message as:",user);
    socketRef.current?.emit("send-message", {
      roomId,
      message: chatInput,
      userId:user.id,
      name:user.name
    });
    setChatInput("");
  };

  const createPeerConnection = () => {
  // Close any existing connection to avoid duplicates
  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // Add local tracks so the other peer gets our stream
  localStreamRef.current?.getTracks().forEach((track) => {
    pc.addTrack(track, localStreamRef.current!);
  });

  // Send our ICE candidates to the other peer via socket
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socketRef.current?.emit("ice-candidate", {
        roomId,
        candidate: event.candidate,
      });
    }
  };

  // When remote stream arrives, show it in the remote video element
  pc.ontrack = (event) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = event.streams[0];
    }
  };

  peerConnectionRef.current = pc;
  return pc;
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
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
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
      const user = getUser();
      socketRef.current?.emit("join-room", {
        roomId,
        userId:user.id,
        name:user.name
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

    const handleParticipantsUpdate = async (
      users: Array<{ socketId: string; userId: string; name: string }>
    ) => {
      setParticipants(users);
      // Second user to join initiates the call
      if (users.length === 2) {
         const mySocketId = socketRef.current?.id;
         const isInitiator = users[users.length - 1].socketId === mySocketId;
         if (isInitiator) {
          setTimeout(async () => {
            const pc = createPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit("offer", { roomId, offer });
          }, 500);
        }
      }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit("answer", { roomId, answer });
    };
    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
      await peerConnectionRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    };
    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        await peerConnectionRef.current?.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };
    const handlePeerDisconnected = () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };

    // Chat listener
    const handleReceiveMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };
    
    
    socketRef.current.on("receive-message", handleReceiveMessage);

    socketRef.current.on("connect", handleConnect);
    socketRef.current.on("code-change", handleCodeChange);
    socketRef.current.on("load-code", handleLoadCode);
    socketRef.current.on("participants-update", handleParticipantsUpdate);
    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleIceCandidate);
    socketRef.current.on("peer-disconnected", handlePeerDisconnected);

    if (socketRef.current.connected) {
      handleConnect();
    }

    return () => {
      socketRef.current?.off("connect", handleConnect);
      socketRef.current?.off("code-change", handleCodeChange);
      socketRef.current?.off("load-code", handleLoadCode);
      socketRef.current?.off("participants-update", handleParticipantsUpdate);
      socketRef.current?.off("receive-message", handleReceiveMessage);
      socketRef.current?.off("offer", handleOffer);
      socketRef.current?.off("answer", handleAnswer);
      socketRef.current?.off("ice-candidate", handleIceCandidate);
      socketRef.current?.off("peer-disconnected", handlePeerDisconnected);
      peerConnectionRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, [roomId]);
  useEffect(() => {
  chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);

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
                    {user.name}
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
          {/* Video Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Video size={18} />
            <h2 className="font-semibold">Video Call</h2>
            </div>
          {/* Remote video — other person */}
        <div className="relative bg-slate-800 rounded-xl h-36 border border-slate-700 overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"/>
          <span className="absolute bottom-1 left-2 text-xs text-slate-500">Remote</span>
          </div>
        {/* Local video — your preview */}
        <div className="relative bg-slate-800 rounded-xl h-24 border border-slate-700 overflow-hidden mt-2">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
          <span className="absolute bottom-1 left-2 text-xs text-slate-500">You</span>
        </div>
        </div>
          {/* Chat Section */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-sm">💬 Chat</h2>
              </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 text-sm text-slate-300 pr-1">
              {messages.length === 0 ? (
                <div className="text-slate-500 text-xs">No messages yet...</div>) : (messages.map((msg, i) => (
                <div key={i} className="bg-slate-800 px-3 py-2 rounded-lg break-words">
                  <span className="text-blue-400 font-semibold">{msg.name}: </span>
                  <span>{msg.message}</span>
                  </div>
                  ))
                  )}
                  <div ref={chatEndRef} />
                  </div>
              {/* Input */}
              <div className="flex gap-2 mt-3">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message..." className="flex-1 bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"/>
                <button onClick={sendMessage} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"> Send</button>
                </div>
              </div>
        </div>
      </div>
    </div>
    
  );
};

export default Room;