require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const initSocketHandlers = require("./sockets/socketHandler");

const app = express();
const server = http.createServer(app);

/*
   Socket.IO Setup
*/
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});


initSocketHandlers(io);

/*
   Core Middleware
 */
app.use(cors());
app.use(express.json());

/*
   Routes
*/
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);


app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/*
   Centralized Error Handler
*/
app.use((err, _req, res, _next) => {
  console.error("Centralized Error:", err.stack || err.message);
  res.status(500).json({
    message: process.env.NODE_ENV === "production"
      ? "Server error"
      : err.message,
  });
});

/*
   Server Startup
*/
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 CodeCollab server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  });

module.exports = { app, server, io };
