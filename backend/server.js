require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { body, param } = require("express-validator");
const { sendMail } = require("./utils/sendMail");
const http = require("http");
const morgan = require("morgan");
// const app = express();
// const http = require("http");
const { Server } = require("socket.io");

// Server setup
const server = express();
const socketServer = http.createServer(server);

const io = new Server(socketServer, {
    cors: {
        origin: ["*", "https://application-wezi.vercel.app/"],
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

// socket.io user map
const userSocketMap = {};
const User = require("./models/userModel");
const Department = require("./models/departmentModel");


// SERVICES
const userService = require("./services/userServices");
const authService = require("./services/authService");
const validate = require("./middleware/validate");
const AppointmentServices = require("./services/appointementsService");
const departmentService = require("./services/departmentService");
const serviceServices = require("./services/serviceService")
const getAvailableDriver = require("./utils/getAvailableDriver");
const emergencyService = require("./services/emergencyService")
const { sendEmergencyNotification } = require("./services/emai.service");
const { sendNewEnquiryEmail } = require("./utils/sendMail");
const Enquiry = require("./models/Enquiry");
const Emergency = require("./models/emergencies");
const DriverLocation = require("./models/driverLocation"); // You'll need to create this model
const {
    calculateDistance,
    findBestDriverForEmergency,
    updateDriverLocation,
    getActiveEmergenciesWithLocations,
    CLINIC_CENTER
} = require("./services/emergencyService"); // You'll need to create this service

// Middleware
server.use(cors());
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(morgan("dev"));
server.get("/", (req, res) => {
    res.send("Welcome to Wezi Clinic API");
});

// JWT Auth Middleware
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "Missing authorization header" });
    const token = header.split(" ")[1];
    try {
        const payload = jwt.decode(token);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

server.get('/dashboard/:role', auth, async (req, res) => {
    try {
        // Only admin can access
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }

        // Count patients
        const patientsCount = await User.countDocuments({ role: 'patient' });

        // Count staff
        const staffCount = await User.countDocuments({ role: 'staff' });

        // Count HODs (department heads)
        const hodsCount = await User.countDocuments({ role: 'department_head' });

        // Count departments
        const departmentsCount = await Department.countDocuments();

        // Optional: send some user info for the dashboard hero
        const userInfo = await User.findById(req.user.id).select('full_name email role');

        res.json({
            userData: {
                id: userInfo._id,
                full_name: userInfo.full_name,
                email: userInfo.email,
                role: userInfo.role,
            },
            users: {
                patients: patientsCount,
                staff: staffCount,
                hods: hodsCount,
            },
            departments: departmentsCount,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- USERS ROUTES ADMINS ONLY ROUTES--- //

// Get all users
server.get("/api/allusers", auth, async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

server.get("/api/role/:role", async (req, res) => {
    try {
        const users = await userService.tempRole(req.params.role);
        return res.status(200).json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get single user by ID
server.get(
    "/api/getUser/:id",
    [param("id").notEmpty().withMessage("Invalid user ID")],
    validate,
    auth,
    async (req, res) => {
        try {
            const user = await userService.getUserById(req.params.id);
            return res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Update a single user
server.put(
    "/api/updateuser/:id",
    [
        param("id").notEmpty().withMessage("Invalid user ID"),
    ],
    validate,
    auth,
    async (req, res) => {
        try {
            const updatedUser = await userService.updateUser(req.params.id, req.body);
            return res.status(200).json(updatedUser);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

server.put("/api/changeStatus/:id", async (req, res) => {
    try {
        const updatedUser = await userService.changeUserStatus(req.params.id);
        return res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
// Create a new user
server.post(
    "/api/create-user",
    [
        body("username").notEmpty().withMessage("Username is required"),
        body("email").isEmail().withMessage("Valid email is required"),
        // body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
        body("role").notEmpty().withMessage("Role is required"),
    ],
    validate,
    async (req, res) => {
        try {
            const newUser = await userService.createUser(req.body);
            console.log(newUser)

            return res.status(201).json(newUser);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Soft delete a user
server.put(
    "/api/softDeleteUser/:id",
    [param("id").notEmpty().withMessage("Invalid user ID")],
    validate,
    auth,
    async (req, res) => {
        try {
            await userService.changeUserStatus(req.params.id);
            return res.status(200).json({ message: "User soft-deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// --- AUTH ROUTES --- //

// Login
server.post(
    "/api/login",
    [
        body("username").notEmpty().withMessage("Username is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    validate,
    async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await authService.login(username, password);
            if (user.error) return res.status(400).json({ error: user.error });
            return res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// -- PATIENT ONLY ROUTES -- //
// Register
server.post(
    "/api/register",
    [
        body("username").notEmpty().withMessage("Username is required"),
        body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    ],
    validate,
    async (req, res) => {
        try {
            const newUser = await authService.register(req.body);
            if (newUser.error) return res.status(400).json({ error: newUser.error });
            return res.status(201).json(newUser);
        } catch (error) {
            console.log(error)
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// --- APPOINTMENTS ROUTES --- //

//create a new appointment
server.post("/api/create-appointment", async (req, res) => {
    try {
        const newAppointment = await AppointmentServices.createAppointment(req.body);
        if (newAppointment.error) {
            return res.status(400).json({ error: "No doctors available for this service" });
        }
        return res.status(201).json(newAppointment);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})

//approve appointment
server.put("/api/approve-appointment/:id", async (req, res) => {
    try {
        const appointment = await AppointmentServices.approveAppointment(req.params.id);
        if (appointment.error) {
            return res.status(400).json({ error: appointment.error });
        }
        return res.status(200).json(appointment);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})

// postpone the apppointement
server.put("/api/postpone-appointment/:id", async (req, res) => {
    try {
        const appointment = await AppointmentServices.moveDate(req.params.id, req.body);
        if (appointment.error) {
            return res.status(400).json({ error: appointment.error });
        }
        return res.status(200).json(appointment);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})
server.get("/api/get-appointment/:id", async (req, res) => {
    try {
        const appointement = await AppointmentServices.getAllAppointments(req.params.id);

        if (appointement.error) {
            return res.status(404).json({ error: appointement.error });
        }

        return res.status(200).json(appointement);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
server.get("/api/all-appointments/:id", auth, async (req, res) => {
    try {
        // const {role} = req.query;
        console.log(req.query.role)
        const appointments = await AppointmentServices.getAllAppointments(req.params.id, req.query.role);
        if (appointments.error) {
            return res.status(400).json({ error: appointments.error });
        }
        return res.status(200).json(appointments);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})
// -- DEPARTMENTS -- //

// get all departments
server.get("/api/all-departments", async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();
        return res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
//create a new department
server.post("/api/create-department",auth, async (req, res) => {
    try {
        const newDepartment = await departmentService.createDepartment(req.body);
        return res.status(200).json(newDepartment)
    } catch (error) {
        console.log(error.message)
        return res.status(500).json(error.message)
    }
})

//update the departments 
server.put("/api/update-department/:id", async (req, res) => {
    try {
        console.log(req.body)
        const updatedDepartment = await departmentService.updateDepartment(req.params.id, req.body);
        if (departmentService.error) {
            return { error: departmentService.error }
        }

        return res.status(200).json(updatedDepartment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
// Add these routes to your main server file (replacing the existing service routes)

// -- SERVICES CRUD OPERATIONS -- //

// Get all services
server.get("/api/all-services", async (req, res) => {
    try {
        const allServices = await serviceServices.getAllServices(); // Fixed function name
        if (allServices.error) {
            return res.status(400).json({ error: allServices.error });
        }
        return res.status(200).json({
            success: true,
            data: allServices,
            count: allServices.length
        });
    } catch (error) {
        console.error("Get all services error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Get single service by ID
server.get("/api/service/:id",auth , async (req, res) => {
    try {
        const service = await serviceServices.getOneService(req.params.id);
        if (service.error) {
            return res.status(404).json({ error: service.error });
        }
        return res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error("Get service error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Create a new service
server.post("/api/create-service", auth, [
    body("name").notEmpty().withMessage("Service name is required"),
    body("departmentId").notEmpty().withMessage("Department ID is required"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters")
], validate, async (req, res) => {
    try {
        const newService = await serviceServices.createService(req.body);

        if (newService.error) {
            console.log("Service creation error:", newService.error);
            return res.status(400).json({ error: newService.error });
        }

        return res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: newService
        });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Update an existing service
server.put("/api/update-service/:id", auth, [
    param("id").notEmpty().withMessage("Service ID is required"),
    body("name").optional().notEmpty().withMessage("Service name cannot be empty"),
    body("departmentId").optional().notEmpty().withMessage("Department ID cannot be empty"),
    body("description").optional().isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters")
], validate, async (req, res) => {
    try {
        const updatedService = await serviceServices.updateServices(req.params.id, req.body);
        
        if (updatedService.error) {
            return res.status(400).json({ error: updatedService.error });
        }

        return res.status(200).json({
            success: true,
            message: "Service updated successfully",
            data: updatedService
        });
    } catch (error) {
        console.error("Update service error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Delete a service
server.delete("/api/delete-service/:id", auth, [
    param("id").notEmpty().withMessage("Service ID is required")
], validate, async (req, res) => {
    try {
        const result = await serviceServices.deleteService(req.params.id);
        
        if (result.error) {
            return res.status(404).json({ error: result.error });
        }

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error("Delete service error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Get services by department
server.get("/api/services/department/:departmentId", async (req, res) => {
    try {
        const services = await serviceServices.getServicesByDepartment(req.params.departmentId);
        
        if (services.error) {
            return res.status(400).json({ error: services.error });
        }

        return res.status(200).json({
            success: true,
            data: services,
            count: services.length
        });
    } catch (error) {
        console.error("Get services by department error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Get emergency services only
server.get("/api/services/emergency", async (req, res) => {
    try {
        const emergencyServices = await serviceServices.getEmergencyServices();
        
        if (emergencyServices.error) {
            return res.status(400).json({ error: emergencyServices.error });
        }

        return res.status(200).json({
            success: true,
            data: emergencyServices,
            count: emergencyServices.length
        });
    } catch (error) {
        console.error("Get emergency services error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// --- EMERGENCIES --- //
// Get active emergency for patients
server.get("/api/emergency/active/:userType/:id", async (req, res) => {
    try {
        const { userType, id } = req.params;

        const emergency = await emergencyService.patientEmergencies(id, userType);
        if (!emergency) {
            return res.status(404).json({ error: "No active emergency found" });
        }

        return res.status(200).json(emergency);
    } catch (err) {
        console.error("❌ Error fetching active patient emergencies:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Get active emergency for ambulance drivers
server.get("/api/emergency/active/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const emergency = await emergencyService.ActiveAmbulanceEmergency(id);
        if (!emergency) {
            return res.status(404).json({ error: "No active emergency found" });
        }

        return res.status(200).json(emergency);
    } catch (err) {
        console.error("❌ Error fetching active driver emergencies:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});


// Get all emergencies for a driver
server.get("/driver/:driverId", async (req, res) => {
    try {
        const { driverId } = req.params;

        const emergencies = await emergencyService.driverEmergencies(driverId);
        if (!emergencies || emergencies.length === 0) {
            return res.status(404).json({ error: "No emergencies found for this driver" });
        }

        return res.status(200).json(emergencies);
    } catch (err) {
        console.error("❌ Error fetching driver emergencies:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

io.on("connection", (socket) => {
    socket.on("updateDriverLocation", async (locationData, callback) => {
        const { driverId, location, speed, heading } = locationData;

        try {
            const updatedLocation = await updateDriverLocation(driverId, location, {
                currentSpeed: speed || 0,
                heading: heading || 0
            });

            // Broadcast location update to admin dashboard
            socket.broadcast.to('admin-dashboard').emit('driverLocationUpdate', {
                driverId,
                location,
                speed,
                heading,
                lastUpdated: updatedLocation.lastUpdated
            });

            // Update any assigned emergencies about driver location
            const activeEmergencies = await Emergency.find({
                assignedTo: driverId,
                status: { $in: ['assigned', 'enroute'] }
            });

            activeEmergencies.forEach(emergency => {
                // Notify patients about driver location
                if (emergency.userType === 'registred' && userSocketMap[emergency.sender]) {
                    io.to(userSocketMap[emergency.sender]).emit('driverLocationUpdate', {
                        emergencyId: emergency._id,
                        driverLocation: location,
                        estimatedArrival: calculateETA(location, {
                            lat: emergency.locationLat,
                            lng: emergency.locationLang
                        })
                    });
                }
            });

            callback({ status: 'success', location: updatedLocation });
        } catch (error) {
            console.error('Error updating driver location:', error);
            callback({ status: 'error', message: error.message });
        }
    });

    socket.on("joinAdminDashboard", (callback) => {
        socket.join('admin-dashboard');
        callback({ status: 'success', message: 'Joined admin dashboard room' });
    });

    socket.on("getActiveEmergenciesMap", async (callback) => {
        try {
            const emergencies = await getActiveEmergenciesWithLocations();
            const onlineDrivers = await DriverLocation.find({ isOnline: true })
                .populate('driverId', 'full_name role');

            callback({
                status: 'success',
                data: {
                    emergencies,
                    drivers: onlineDrivers.map(d => ({
                        id: d.driverId._id,
                        name: d.driverId.full_name,
                        location: d.currentLocation,
                        isOnline: d.isOnline,
                        lastUpdated: d.lastUpdated
                    }))
                }
            });
        } catch (error) {
            callback({ status: 'error', message: error.message });
        }
    });

    // Get all online drivers with locations
    server.get("/api/drivers/locations", auth, async (req, res) => {
        try {
            const driversWithLocations = await DriverLocation.find({ isOnline: true })
                .populate('driverId', 'full_name email role')
                .sort({ lastUpdated: -1 });

            res.json({
                status: 'success',
                data: driversWithLocations.map(d => ({
                    id: d.driverId._id,
                    name: d.driverId.full_name,
                    email: d.driverId.email,
                    location: d.currentLocation,
                    lastUpdated: d.lastUpdated,
                    isOnline: d.isOnline,
                    speed: d.currentSpeed,
                    heading: d.heading
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get emergency details with live tracking
    server.get("/api/emergency/:id/tracking", async (req, res) => {
        try {
            const emergency = await Emergency.findById(req.params.id)
                .populate('sender assignedTo');

            if (!emergency) {
                return res.status(404).json({ error: 'Emergency not found' });
            }

            let driverLocation = null;
            if (emergency.assignedTo) {
                const driverLoc = await DriverLocation.findOne({
                    driverId: emergency.assignedTo._id
                });

                if (driverLoc) {
                    driverLocation = {
                        lat: driverLoc.currentLocation.lat,
                        lng: driverLoc.currentLocation.lng,
                        lastUpdated: driverLoc.lastUpdated,
                        isOnline: driverLoc.isOnline,
                        speed: driverLoc.currentSpeed
                    };
                }
            }

            res.json({
                status: 'success',
                data: {
                    emergency: emergency.toObject(),
                    driverLocation,
                    patientLocation: {
                        lat: emergency.locationLat,
                        lng: emergency.locationLang
                    }
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update driver availability
    server.put("/api/driver/:id/availability", auth, async (req, res) => {
        try {
            const { isOnline } = req.body;

            const updatedLocation = await DriverLocation.findOneAndUpdate(
                { driverId: req.params.id },
                { isOnline },
                { new: true, upsert: true }
            ).populate('driverId', 'full_name role');

            // Broadcast availability change
            io.to('admin-dashboard').emit('driverAvailabilityChange', {
                driverId: req.params.id,
                isOnline,
                driver: updatedLocation.driverId
            });

            res.json({ status: 'success', data: updatedLocation });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get dashboard data for admin
    server.get("/api/admin/emergency-dashboard", auth, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Admin access required' });
            }

            const [activeEmergencies, onlineDrivers, recentEmergencies] = await Promise.all([
                getActiveEmergenciesWithLocations(),
                DriverLocation.find({ isOnline: true }).populate('driverId', 'full_name role'),
                Emergency.find({}).sort({ createdAt: -1 }).limit(10)
                    .populate('sender assignedTo', 'full_name role')
            ]);

            res.json({
                status: 'success',
                data: {
                    activeEmergencies,
                    onlineDrivers: onlineDrivers.length,
                    driversWithLocations: onlineDrivers.map(d => ({
                        id: d.driverId._id,
                        name: d.driverId.full_name,
                        location: d.currentLocation,
                        lastUpdated: d.lastUpdated
                    })),
                    recentEmergencies,
                    stats: {
                        totalActive: activeEmergencies.length,
                        pendingAssignment: activeEmergencies.filter(e => e.status === 'onHold').length,
                        inProgress: activeEmergencies.filter(e => e.status === 'assigned').length
                    }
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Calculate ETA helper function
    const calculateETA = (driverLocation, patientLocation, averageSpeed = 40) => {
        const distance = calculateDistance(
            driverLocation.lat, driverLocation.lng,
            patientLocation.lat, patientLocation.lng
        );
        return Math.ceil((distance / averageSpeed) * 60); // ETA in minutes
    };
    // Enhanced emergency creation
    socket.on("sendEmergency", async (emergencyPayload, callback) => {
        const { userType, sender, userDeviceId, locationLat, locationLang, priority = 'MEDIUM' } = emergencyPayload;

        try {
            // Use smart driver selection
            const bestDriverResult = await findBestDriverForEmergency(
                { lat: locationLat, lng: locationLang },
                priority
            );

            let status = "onHold";
            let assignedTo = null;

            if (!bestDriverResult.error) {
                status = "assigned";
                assignedTo = bestDriverResult.driver._id;
            }

            // Create emergency
            let newEmergency = await Emergency.create({
                userType,
                ...(userType === "registred" ? { sender } : { userDeviceId }),
                locationLat,
                locationLang,
                status,
                assignedTo,
            });

            // Populate the emergency
            newEmergency = await newEmergency.populate([
                { path: "sender" },
                { path: "assignedTo" },
            ]);

            // Notify assigned driver with enhanced information
            if (assignedTo && userSocketMap[assignedTo]) {
                const driverLocation = bestDriverResult.driverLocation;
                const distance = bestDriverResult.distance;

                io.to(userSocketMap[assignedTo]).emit("receiveEmergency", {
                    ...newEmergency.toObject(),
                    distanceToPatient: distance,
                    estimatedArrival: Math.ceil(distance / 40 * 60), // Rough ETA in minutes
                    patientLocation: {
                        lat: locationLat,
                        lng: locationLang
                    }
                });
            }

            // Notify admin dashboard
            io.to('admin-dashboard').emit('newEmergency', {
                emergency: newEmergency,
                assignedDriver: bestDriverResult.error ? null : {
                    id: bestDriverResult.driver._id,
                    name: bestDriverResult.driver.full_name,
                    location: bestDriverResult.driverLocation.currentLocation,
                    distance: bestDriverResult.distance
                }
            });

            callback({
                status: "success",
                emergency: newEmergency,
                driverInfo: bestDriverResult.error ? null : {
                    name: bestDriverResult.driver.full_name,
                    estimatedArrival: Math.ceil(bestDriverResult.distance / 40 * 60)
                }
            });

        } catch (err) {
            console.error("Error creating emergency:", err);
            callback({ status: "error", message: err.message });
        }
    });
})
// Connect to MongoDB

const MONGO = process.env.MONGO_URI;
mongoose
    .connect(MONGO)
    .then(() => {
        console.log("✅ MongoDB connected");
        // Start Server
        const PORT = process.env.PORT;
        socketServer.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 Backend running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    })
