const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ["guest", "registred"],
      default: "guest",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [
        function () {
          return this?.userType === "registred";
        },
        "User Id is required for registred users",
      ],
    },
    userDeviceId: {
      type: String,
      required: [
        function () {
          return this?.userType === "guest";
        },
        "Device Id is required for guest users",
      ],
    },
    message: {
      type: String,
      required: [true, "Please specify the message"],
    },
    sender: {
      type: String,
      required: [true, "Please specify the sender"],
      enum: ["bot", "user", "hod"],
    },
    metadata: {
      subTitle: {
        type: String,
      },
      state: {
        type: String,
        enum: ["chat", "appointment booking", "initialized"],
      },
      from: {
        type: String,
      },
      escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
      escalatedDept: {
        type: String,
      },
      seen: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", ChatSchema);
