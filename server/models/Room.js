const mongoose = require("mongoose");

const { Schema } = mongoose;

const roomSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    code: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // In case you want updatedAt later
    timestamps: false,
  }
);

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;

