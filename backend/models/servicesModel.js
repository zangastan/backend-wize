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
        },
        createdAt: { type: Date, default: Date.now() },
        updatedAt: { type: Date, default: Date.now() },
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.Services || mongoose.model("Services", servicesSchema);
