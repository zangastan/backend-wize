const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
    {
        name: { type: String },
        description: String,
        location: String,
        head: String,
        email: String,
        status: String,
        phone: String,
        isEmergencyService: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.models.Department || mongoose.model("Department", departmentSchema);
