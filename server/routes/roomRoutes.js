const express = require("express");
const { createRoom, getRoomById } = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// @route   POST /api/rooms/create
// @desc    Create a new room
// @access  Private
router.post("/create", authMiddleware, createRoom);

// @route   GET /api/rooms/:roomId
// @desc    Get room by roomId
// @access  Private
router.get("/:roomId", authMiddleware, getRoomById);

module.exports = router;

