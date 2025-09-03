// models/Department.js
const mongoose = require("mongoose");

const servicesSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        isEmergencyService: { type: Boolean, default: false },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",   // 👈 reference the Departments model
            required: true
        }
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.Services || mongoose.model("Services", servicesSchema);
