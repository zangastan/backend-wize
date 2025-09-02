const { default: mongoose } = require("mongoose");

const EmergencySchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ["guest", "registred"],
      default: "guest",
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: [
        function () {
          return this?.userType === "registered";
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
    locationLang: {
      type: Number,
      required: [true, "Please provide the location langtude"],
    },
    locationLat: {
      type: Number,
      required: [true, "Please provide the location latitude"],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "onHold", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Emergency", EmergencySchema);
