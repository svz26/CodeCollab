const crypto = require("crypto");
const Room = require("../models/Room");

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private (should use authMiddleware)
const createRoom = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const roomId = crypto.randomUUID();

    const room = await Room.create({
      roomId,
      createdBy: req.user._id,
      participants: [req.user._id],
    });

    return res.status(201).json(room);
  } catch (error) {
    console.error("Create room error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get room by roomId
// @route   GET /api/rooms/:roomId
// @access  Private (can be adjusted as needed)
const getRoomById = async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json(room);
  } catch (error) {
    console.error("Get room error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createRoom,
  getRoomById,
};

