// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { body, param } = require("express-validator");
const http = require("http");
const morgan = require("morgan");
const { Server } = require("socket.io");

// Models
const User = require("./models/userModel");
const Department = require("./models/departmentModel");
const Enquiry = require("./models/Enquiry");
const Emergency = require("./models/emergencies");
const DriverLocation = require("./models/driverLocation");

// Services
const userService = require("./services/userServices");
const authService = require("./services/authService");
const AppointmentServices = require("./services/appointementsService");
const departmentService = require("./services/departmentService");
const serviceServices = require("./services/serviceService");
const emergencyService = require("./services/emergencyService");

// Middleware
const validate = require("./middleware/validate");

// Helpers
const { sendMail } = require("./utils/sendMail");
const { sendEmergencyNotification } = require("./services/emai.service");
const { getAvailableDriver } = require("./utils/getAvailableDriver");

// Server & Socket Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["*", "https://application-wezi.vercel.app/"],
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

// Socket maps
const userSocketMap = {};
const deviceSocketMap = {};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));

// JWT auth
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "Missing authorization header" });
    const token = header.split(" ")[1];
    try {
        req.user = jwt.decode(token);
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};

// ------------------- HELPER FUNCTIONS ------------------- //

// Haversine distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ETA with traffic considerations
const calculateETA = (driverLocation, patientLocation, currentSpeed = 0, timeOfDay = new Date()) => {
    const distance = calculateDistance(driverLocation.lat, driverLocation.lng, patientLocation.lat, patientLocation.lng);
    let avgSpeed = 35;
    if (currentSpeed > 5) avgSpeed = Math.min(currentSpeed * 0.8, 60);
    else {
        const hour = timeOfDay.getHours();
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) avgSpeed = 25;
        else if (hour >= 22 || hour <= 6) avgSpeed = 45;
    }
    return Math.max(1, Math.ceil((distance / avgSpeed) * 60));
};

// Update driver location
const updateDriverLocation = async (driverId, location, additionalData = {}) => {
    const updateData = {
        currentLocation: { lat: parseFloat(location.lat), lng: parseFloat(location.lng) },
        lastUpdated: new Date(),
        isOnline: true,
        currentSpeed: additionalData.currentSpeed || 0,
        heading: additionalData.heading || 0,
        accuracy: additionalData.accuracy || 0
    };
    return await DriverLocation.findOneAndUpdate(
        { driverId },
        updateData,
        { new: true, upsert: true }
    ).populate('driverId', 'full_name role phone');
};

// ------------------- SOCKET.IO ------------------- //

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Update driver location
    socket.on("updateDriverLocation", async (locationData, callback) => {
        const { driverId, location, speed, heading, accuracy } = locationData;
        try {
            const updatedLocation = await updateDriverLocation(driverId, location, { currentSpeed: speed, heading, accuracy });
            
            // Active emergencies
            const activeEmergencies = await Emergency.find({ assignedTo: driverId, status: { $in: ['assigned', 'enroute'] } }).populate('sender');
            
            for (const emergency of activeEmergencies) {
                const patientLocation = { lat: emergency.locationLat, lng: emergency.locationLang };
                const distance = calculateDistance(location.lat, location.lng, patientLocation.lat, patientLocation.lng);
                const eta = calculateETA(location, patientLocation, speed);

                const updateData = {
                    emergencyId: emergency._id,
                    driverLocation: { ...location, speed, accuracy, lastUpdated: new Date() },
                    distance, estimatedArrival: eta,
                    driverInfo: { name: updatedLocation.driverId.full_name, phone: updatedLocation.driverId.phone }
                };

                // Emit to patient or device
                if (emergency.userType === 'registred' && emergency.sender && userSocketMap[emergency.sender._id])
                    io.to(userSocketMap[emergency.sender._id]).emit('driverLocationUpdate', updateData);

                if (emergency.userType === 'anonymous' && emergency.userDeviceId && deviceSocketMap[emergency.userDeviceId])
                    io.to(deviceSocketMap[emergency.userDeviceId]).emit('driverLocationUpdate', updateData);
            }

            // Broadcast to admin dashboard
            socket.broadcast.to('admin-dashboard').emit('driverLocationUpdate', { driverId, location, speed, heading, lastUpdated: new Date(), activeEmergencies: activeEmergencies.length });

            callback({ status: 'success', location: updatedLocation, emergenciesUpdated: activeEmergencies.length });
        } catch (error) {
            console.error(error);
            callback({ status: 'error', message: error.message });
        }
    });

    socket.on("joinAdminDashboard", (callback) => {
        socket.join('admin-dashboard');
        callback({ status: 'success', message: 'Joined admin dashboard room' });
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        Object.keys(userSocketMap).forEach(userId => { if (userSocketMap[userId] === socket.id) delete userSocketMap[userId]; });
        Object.keys(deviceSocketMap).forEach(deviceId => { if (deviceSocketMap[deviceId] === socket.id) delete deviceSocketMap[deviceId]; });
    });
});

// ------------------- API ENDPOINTS ------------------- //

// Root
app.get("/", (req, res) => res.send("Welcome to Wezi Clinic API"));

// User routes
app.get("/api/allusers", auth, async (req, res) => {
    try { res.json(await userService.getAllUsers()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Role-based user fetching
app.get("/api/role/:role", async (req, res) => {
    try { res.json(await userService.tempRole(req.params.role)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Single user
app.get("/api/getUser/:id", [param("id").notEmpty()], validate, auth, async (req, res) => {
    try { res.json(await userService.getUserById(req.params.id)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Update user
app.put("/api/updateuser/:id", [param("id").notEmpty()], validate, auth, async (req, res) => {
    try { res.json(await userService.updateUser(req.params.id, req.body)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Create user
app.post("/api/create-user", [
    body("username").notEmpty(),
    body("email").isEmail(),
    body("role").notEmpty()
], validate, async (req, res) => {
    try { res.status(201).json(await userService.createUser(req.body)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Soft delete user
app.put("/api/softDeleteUser/:id", [param("id").notEmpty()], validate, auth, async (req, res) => {
    try { await userService.changeUserStatus(req.params.id); res.json({ message: "User soft-deleted" }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Department routes
app.get("/api/departments", auth, async (req, res) => {
    try { res.json(await departmentService.getAllDepartments()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Batch driver location updates
app.post("/api/drivers/batch-location-update", auth, async (req, res) => {
    const updates = req.body; // [{ driverId, location, speed, heading }]
    try {
        const results = await Promise.allSettled(updates.map(u => updateDriverLocation(u.driverId, u.location, { currentSpeed: u.speed, heading: u.heading })));
        res.json({ message: "Batch update complete", results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------- DATABASE CONNECTION ------------------- //
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => server.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`)))
    .catch(err => console.error("MongoDB connection error:", err));
