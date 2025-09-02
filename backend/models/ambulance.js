// models/AmbulanceRequest.js
const mongoose = require("mongoose");

const ambulanceRequestSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    location: { type: String, required: true }, // pickup address
    destination: { type: String }, // hospital or another facility
    gpsCoords: {
      lat: Number,
      lng: Number,
    },
    status: {
      type: String,
      enum: ["requested", "enroute", "arrived", "completed", "cancelled"],
      default: "requested",
    },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // staff from transport dept
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AmbulanceRequest ||
  mongoose.model("AmbulanceRequest", ambulanceRequestSchema);
