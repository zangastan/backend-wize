const services = require("./backend/models/servicesModel")
const mongoose = require('mongoose');

const MONGO = "mongodb://localhost:27017/wezz_clinic";

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

async function seedDepartments() {
    const departments = [
        {
            name: "Cardiac Catheterization",
            departmentId: "68b6303dead27f943db16383",
            description:
                "Minimally invasive procedure to diagnose and treat cardiovascular conditions",
            isEmergencyService: true,
            createdAt: "2024-01-15",
        },
        {
            name: "Emergency Room Treatment",
            departmentId: "68b6303dead27f943db16383",
            description: "24/7 emergency medical care for acute conditions and trauma",
            isEmergencyService: true,
            createdAt: "2024-01-10",
        },
        {
            name: "Pediatric Consultation",
            departmentId: "68b6303dead27f943db16383",
            description:
                "Comprehensive medical care and consultation for children and adolescents",
            isEmergencyService: false,
            createdAt: "2024-02-01",
        },
        {
            name: "X-Ray Imaging",
            departmentId: "68b6303dead27f943db16382",
            description:
                "Digital radiography for diagnostic imaging of bones and internal structures",
            isEmergencyService: false,
            createdAt: "2024-01-20",
        },
        {
            name: "Blood Testing",
            departmentId: "68b6303dead27f943db16382",
            description:
                "Complete blood count, chemistry panels, and specialized laboratory tests",
            isEmergencyService: false,
            createdAt: "2024-01-25",
        },
    ];

    try {
        await services.deleteMany({}); // optional: clears old data
        await services.insertMany(departments);
        console.log("✅ Departments seeded successfully!");
    } catch (err) {
        console.error("❌ Error seeding departments:", err);
    } finally {
        mongoose.connection.close();
    }
}

seedDepartments();
