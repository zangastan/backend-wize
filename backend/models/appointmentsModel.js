const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Services" },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }, // optional, e.g. assigned doctor/nurse
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    time: { type: Date, required: true },
    status: {
      type: String, //Enum ['pending', 'approved' , 'cancelled' , 'past']
      enum: ["scheduled", "approved", "cancelled", "no-show", "completed"],
      default: "scheduled",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);
