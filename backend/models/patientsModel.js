const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    address: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      region: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },
    nationId: { type: String, maxlength: 6 },
    conditions: { type: [String], default: [] },
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      relation: { type: String, default: "" },
    },
    medicalRecords: { type: [String], default: [] }, // store file paths or IDs
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
