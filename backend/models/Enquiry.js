const mongoose = require("mongoose");

const EnquirySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Please enter the text message"],
    },
    sender: {
      type: String,
      required: [true, "Please specify the sender"],
      enum: ["patient", "hod"],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please specify the sender "],
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Enquiry", EnquirySchema);
