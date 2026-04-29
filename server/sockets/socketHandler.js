const Room = require("../models/Room");
const mongoose = require("mongoose");

const rooms = {}; // { roomId: [ { socketId, userId } ] }

// Initialize all socket events
const initSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Join a room by roomId
    socket.on("join-room", async ({ roomId, userId ,name}) => {
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
          userId,
          name,
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

    // REAL-TIME CHAT — add this inside io.on("connection", (socket) => { ... })
    socket.on("send-message", ({ roomId, message, userId,name }) => {
      const msgData = {
        message,
        userId,
        name,
        timestamp: new Date(),
      };
      io.to(roomId).emit("receive-message", msgData);
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
    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", offer);
    });

    socket.on("cursor-move", (data) => {
      console.log("Cursor move received on server:", data);
      socket.to(data.roomId).emit("cursor-move", data);
    });
    
    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", answer);
    });
    
    socket.on("ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("ice-candidate", candidate);
    });

    socket.on("disconnect", () => {
      Object.keys(rooms).forEach((roomId) => {
        const updatedUsers = rooms[roomId].filter(
          (user) => user.socketId !== socket.id
        );

        if (updatedUsers.length !== rooms[roomId].length) {
          rooms[roomId] = updatedUsers;
          io.to(roomId).emit("participants-update", rooms[roomId]);
          io.to(roomId).emit("peer-disconnected");
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