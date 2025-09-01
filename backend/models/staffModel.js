const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    specialties: { type: [String], default: [] }, // e.g. "Cardiology", "Pediatrics"
    workingHours: [
      {
        day: { type: String },
        start: { type: String }, // "08:00"
        end: { type: String },   // "17:00"
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Staff || mongoose.model("Staff", staffSchema);
