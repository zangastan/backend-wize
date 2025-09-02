const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: [true, "Please specify the message"],
    },
    sender: {
      type: String,
      required: [true, "Please specify the sender"],
      enum: ["bot", "user"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", ChatSchema);
