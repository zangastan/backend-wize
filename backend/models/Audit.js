// models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true }, // e.g. "BOOKED_APPOINTMENT"
    details: { type: Object }, // flexible field for metadata
    ipAddress: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
