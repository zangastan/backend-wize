const mongoose = require("mongoose");
const Service = require("./backend/models/servicesModel");

const MONGO = "mongodb://localhost:27017/wezz_clinic";

mongoose
  .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function seedServices() {
  const services = [
    {
      name: "General Surgery",
      description: "Surgical procedures for various conditions and emergencies.",
      departmentId: "68b77c6dc6e8cac83e0370ba", // Theatre
      isEmergencyService: true,
    },
    {
      name: "Obstetrics and Gynecology",
      description: "Comprehensive care for women including pregnancy and reproductive health.",
      departmentId: "68b77c6dc6e8cac83e0370b9", // Antenatal
      isEmergencyService: false,
    },
    {
      name: "Vaccinations",
      description: "Immunization services for children and adults.",
      departmentId: "68b77c6dc6e8cac83e0370b6", // Out Patient Department
      isEmergencyService: false,
    },
    {
      name: "Diagnoses",
      description: "Clinical diagnosis for a wide range of medical conditions.",
      departmentId: "68b77c6dc6e8cac83e0370b6", // Out Patient Department
      isEmergencyService: false,
    },
    {
      name: "Routine Check-ups",
      description: "General health assessments and preventive care.",
      departmentId: "68b77c6dc6e8cac83e0370b6", // Out Patient Department
      isEmergencyService: false,
    },
  ];

  try {
    await Service.deleteMany({}); // optional: clears old data
    await Service.insertMany(services);
    console.log("✅ Services seeded successfully!");
  } catch (err) {
    console.error("❌ Error seeding services:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedServices();
