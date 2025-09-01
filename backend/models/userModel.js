// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, lowercase: true },
    email: { type: String , default : ''},
    password: { type: String, required: true, select: false },
    phone: { type: String },
    linkedPatientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    linkedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    role: {
      type: String,
      default: "patient",
    },
    lastLogin: { type: Date },
    preferredLanguage: { type: String , default : 'en'},
    gender: { type: String },
    dob: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("Users", userSchema);
