const mongoose = require("mongoose");
const Department = require("./backend/models/departmentModel");

const MONGO = "mongodb://localhost:27017/wezz_clinic";

mongoose
  .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function seedDepartments() {
  const departments = [
    {
      name: "Out Patient Department",
      code: "opd",
      roomNumber: "001",
      description: "Provides outpatient medical consultations and treatments.",
      isEmergencyService: false,
    },
    {
      name: "In Patient Department (Admissions)",
      code: "ipd",
      roomNumber: "002",
      description:
        "Handles admissions and care of patients requiring hospitalization.",
      isEmergencyService: false,
    },
    {
      name: "Emergency Department",
      code: "emd",
      roomNumber: "003",
      description: "24/7 care for medical emergencies and trauma cases.",
      isEmergencyService: true,
    },
    {
      name: "Antenatal",
      code: "ant",
      roomNumber: "004",
      description: "Care and consultation services for pregnant women.",
      isEmergencyService: false,
    },
    {
      name: "Theatre",
      code: "thr",
      roomNumber: "005",
      description: "Surgical operations and specialized procedures.",
      isEmergencyService: true,
    },
  ];

  try {
    await Department.deleteMany({}); // optional: clears old data
    await Department.insertMany(departments);
    console.log("✅ Departments seeded successfully!");
  } catch (err) {
    console.error("❌ Error seeding departments:", err);
  } finally {
    mongoose.connection.close();
  }
}

seedDepartments();
