const dpt = require("./backend/models/departmentModel")
const mongoose = require('mongoose');

const MONGO ="mongodb://localhost:27017/wezz_clinic";

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

async function seedDepartments() {
    const departments = [
        {
            name: "HR",
            description: "Handles human resources",
            location: "Building A",
            contactPhone: "12345",
            createdAt: new Date(),
            updatedAt: new Date(),
            isEmergencyService: true
        },
        {
            name: "IT",
            description: "Handles IT",
            location: "Building B",
            contactPhone: "67890",
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    try {
        await dpt.deleteMany({}); // optional: clears old data
        await dpt.insertMany(departments);
        console.log("✅ Departments seeded successfully!");
    } catch (err) {
        console.error("❌ Error seeding departments:", err);
    } finally {
        mongoose.connection.close();
    }
}

seedDepartments();
