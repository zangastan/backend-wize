const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String },
    description: String,
    roomNumber: String,
    head: String,
    email: String,
    status: String,
    phone: String,
    code: {
      type: String,
      required: [true, "The deprtment code is required"],
      unique: [true, "Department code must be unique"],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Department || mongoose.model("Department", departmentSchema);
