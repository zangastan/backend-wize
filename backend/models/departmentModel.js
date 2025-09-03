const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
    {
        name: { type: String },
        description: String,
        location: String,
        roomNumber : {type : String},
        contactPhone : {type : String},
        latitude : {type : Intl},
        longitude : {type : Intl},
        head: String,
        email: String,
        status: String,
        phone: String,
        isEmergencyService: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.models.Department || mongoose.model("Department", departmentSchema);
