const mongoose = require("mongoose");

const servicesSchema = new mongoose.Schema(
    {
        name: { 
            type: String, 
            required: [true, "Service name is required"],
            trim: true,
            maxlength: [100, "Service name cannot exceed 100 characters"]
        },
        description: { 
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters"]
        },
        isEmergencyService: { 
            type: Boolean, 
            default: false 
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
            required: [true, "Department is required"]
        }
        // Remove manual createdAt/updatedAt since timestamps: true handles this
    },
    { 
        timestamps: true // This automatically adds createdAt and updatedAt
    }
);

// Add indexes for better performance
servicesSchema.index({ departmentId: 1 });
servicesSchema.index({ name: 1 });
servicesSchema.index({ isEmergencyService: 1 });

module.exports = mongoose.models.Services || mongoose.model("Services", servicesSchema);