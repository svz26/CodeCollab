const Room = require("../models/Room");
const mongoose = require("mongoose");

const rooms = {}; // { roomId: [ { socketId, userId } ] }

// Initialize all socket events
const initSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Join a room by roomId
    socket.on("join-room", async ({ roomId, userId }) => {
      if (!roomId) return;

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);

      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }

      const exists = rooms[roomId].some((user) => user.socketId === socket.id);

      if (!exists) {
        rooms[roomId].push({
          socketId: socket.id,
          userId: userId || "Guest",
        });
      }

      io.to(roomId).emit("participants-update", rooms[roomId]);

      try {
        let room = await Room.findOne({ roomId });

        if (!room) {
          room = await Room.create({
            roomId,
            code: "",
          });
        }

        socket.emit("load-code", room.code || "");

        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          await Room.findOneAndUpdate(
            { roomId },
            { $addToSet: { participants: userId } },
            { returnDocument: "after" }
          );
        }
      } catch (error) {
        console.error("Error updating room participants:", error.message);
      }
    });

    // Code change event: broadcast to room except sender
    socket.on("code-change", async ({ roomId, code }) => {
      if (!roomId) return;

      try {
        await Room.findOneAndUpdate(
          { roomId },
          { code },
          {
            upsert: true,
          }
        );
      } catch (error) {
        console.error("Error saving room code:", error.message);
      }

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
      Object.keys(rooms).forEach((roomId) => {
        const updatedUsers = rooms[roomId].filter(
          (user) => user.socketId !== socket.id
        );

        if (updatedUsers.length !== rooms[roomId].length) {
          rooms[roomId] = updatedUsers;
          io.to(roomId).emit("participants-update", rooms[roomId]);
        }

        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
      });

      console.log("Client disconnected:", socket.id);
    });
  });
};

module.exports = initSocketHandlers;