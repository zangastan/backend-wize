const mongoose = require("mongoose");

const DriverLocationSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
    unique: true
  },
  currentLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  currentSpeed: {
    type: Number,
    default: 0
  },
  heading: {
    type: Number, // Direction in degrees
    default: 0
  }
}, { timestamps: true });

// Add index for geospatial queries
DriverLocationSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("DriverLocation", DriverLocationSchema);
