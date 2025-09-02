// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, lowercase: true },
    username: { type: String, required: true, unique: true },
    email: { type: String , default : ''},
    password: { type: String, required: true, select: false },
    phone: { type: String },
    linkedPatientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    linkedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    role: {
      type: String,
      enum: ['admin', 'doctor', 'patient', 'nurse', 'ambulance_driver', 'hod'],
      default: "patient",
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastLogin: { type: Date },
    preferredLanguage: { type: String , default : 'en'},
    gender: { type: String },
    dob: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("Users", userSchema);
