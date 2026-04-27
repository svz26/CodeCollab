const Room = require("../models/Room");

// Initialize all socket events
const initSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Join a room by roomId
    socket.on("join-room", async ({ roomId, userId }) => {
      if (!roomId) return;

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);

      try {
        if (userId) {
          await Room.findOneAndUpdate(
            { roomId },
            { $addToSet: { participants: userId } },
            { new: true }
          );
        }
      } catch (error) {
        console.error("Error updating room participants:", error.message);
      }
    });

    // Code change event: broadcast to room except sender
    socket.on("code-change", ({ roomId, code }) => {
      if (!roomId) return;
      socket.to(roomId).emit("code-change", { roomId, code });
    });

    // WebRTC signaling: forward offer/answer/candidates to specific socket
    socket.on("sending-signal", ({ targetSocketId, signal }) => {
      if (!targetSocketId || !signal) return;
      io.to(targetSocketId).emit("receiving-signal", {
        from: socket.id,
        signal,
      });
    });

    socket.on("receiving-signal", ({ targetSocketId, signal }) => {
      if (!targetSocketId || !signal) return;
      io.to(targetSocketId).emit("receiving-signal", {
        from: socket.id,
        signal,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

module.exports = initSocketHandlers;

