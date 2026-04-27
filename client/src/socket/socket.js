import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Create a shared Socket.IO client instance
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket"],
});

export default socket;

