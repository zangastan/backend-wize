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
        origin: "*",
        methods: ["GET", "POST"],
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
server.get("/api/all-departments", auth, async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();
        return res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})
//create a new department
server.post("/api/create-department", auth, async (req, res) => {
    try {
        const newDepartment = await departmentService.createDepartment(req.body);
        return res.status(200).json(newDepartment)
    } catch (error) {
        console.log(error.message)
        return res.status(500).json(error.message)
    }
})

//update the departments 
server.put("/api/update-department/:id", auth, async (req, res) => {
    try {
        const updatedDepartment = await departmentService.updateDepartment(req.params.id, req.body);
        if (departmentService.error) {
            return { error: departmentService.error }
        }

        return res.status(200).json(updatedDepartment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

// -- SERVICES -- //
server.get("/api/all-services", async (req, res) => {
    try {
        const AllServices = await serviceServices.getAllSerevices()
        if (AllServices.error) {
            return { error: AllServices.error }
        }
        return res.status(200).json(AllServices)
    } catch (error) {
        return { error: error.message }
    }
})

// create a new service
server.post("/api/create-service", auth, async (req, res) => {
    try {
        const newService = await serviceServices.createService(req.body)
        if (newService.error) {
            console.log(newService)
            return { error: newService.error }
        }
        return res.status(200).json(newService)
    } catch (error) {
        return { error: error.message }
    }
})

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
    const userId = socket?.handshake?.query?.userId;

    console.log(`User ${userId} is active`);

    if (userId && userId !== "undefined") {
        userSocketMap[userId] = socket.id;
    }

    socket?.on(
        "sendEnquiry",
        async ({ text, sender, timestamp, receiverId, senderId }) => {
            console.log(
                `Text: ${text}, sender: ${sender}, receiverId: ${receiverId}, senderId: ${senderId}`
            );

            try {
                // 1️⃣ Save the new enquiry
                const newEnquiry = await Enquiry.create({
                    senderId,
                    receiverId,
                    timestamp,
                    text,
                    sender,
                });

                // 2️⃣ Emit to the specific receiver if connected
                const receiverSocketId = userSocketMap[receiverId];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("receiveEnquiry", newEnquiry);
                }

                // 3️⃣ If sender is a patient, notify all active HODs
                if (sender === "patient") {
                    const allHods = await User.find({ role: "hod" });

                    const activeHods = allHods.filter((hod) => userSocketMap[hod?._id]);
                    const offlineHods = allHods.filter((hod) => !userSocketMap[hod._id]);

                    // Emit to all active HODs
                    activeHods.forEach((hod) => {
                        try {
                            io.to(userSocketMap[hod._id]).emit("receiveEnquiry", newEnquiry);
                        } catch (err) {
                            console.log(`Failed to emit to HOD ${hod._id}:`, err);
                        }
                    });

                    // 4️⃣ If no HODs are online send email notifications
                    if (!activeHods.length) {
                        allHods.forEach(async (hod) => {
                            await sendNewEnquiryEmail(hod.email);
                        });
                    }
                }

                // 5️⃣ Optional: send email to the receiver if needed
            } catch (error) {
                console.error("Error sending enquiry:", error);
            }
        }
    );

    socket.on("sendEmergency", async (emergencyPayload, callback) => {
        const { userType, sender, userDeviceId, locationLat, locationLang } =
            emergencyPayload;

        try {
            const { availableDriver, email } = await getAvailableDriver();

            let status = "onHold";
            let assignedTo = null;

            if (availableDriver) {
                status = "assigned";
                assignedTo = availableDriver;
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

            // ✅ Populate sender and assignedTo
            newEmergency = await newEmergency.populate([
                { path: "sender" },
                { path: "assignedTo" },
            ]);

            // Notify driver if connected
            if (availableDriver && userSocketMap[availableDriver]) {
                io.to(userSocketMap[availableDriver]).emit(
                    "receiveEmergency",
                    newEmergency
                );
            }

            // Send email
            if (email) {
                await sendEmergencyNotification(email, {
                    locationLat,
                    locationLang,
                });
            }

            console.log(newEmergency);

            // ✅ Send populated emergency back to client
            callback({ status: "success", emergency: newEmergency });
        } catch (err) {
            console.error("Error creating emergency:", err);
            callback({ status: "error", message: err.message });
        }
    });

    socket?.on("completeEmergency", async (id, callback) => {
        try {
            // Mark the current emergency as completed
            const emergency = await Emergency.findByIdAndUpdate(
                id,
                { status: "completed" },
                { new: true }
            );

            if (!emergency) {
                return callback({ status: "error", message: "Emergency not found" });
            }

            //update the patient's side
            if (userSocketMap[emergency.sender]) {
                io.to(userSocketMap[emergency.sender]).emit("completedEmergency");
            }

            //update the driver's side
            if (userSocketMap[emergency.assignedTo]) {
                io.to(userSocketMap[emergency.assignedTo]).emit("completedEmergency");
            }

            // Find the next emergency that is on hold
            const nextEmergency = await Emergency.findOne({ status: "onHold" });

            if (nextEmergency) {
                nextEmergency.status = "assigned";
                nextEmergency.assignedTo = emergency.assignedTo;
                await nextEmergency.save();

                // Fetch the email of the driver/staff assigned
                const userData = await Emergency.findById(nextEmergency._id)
                    .populate("assignedTo", "email")
                    .select("assignedTo");

                const email = userData?.assignedTo?.email;

                if (email) {
                    await sendEmergencyNotification(email, "New Emergency Assigned", {
                        userLocationLatitude: nextEmergency.userLocationLatitude,
                        userLocationLongitude: nextEmergency.userLocationLongitude,
                    });
                }
            }

            // Send back success via socket callback
            callback({
                status: "success",
                message: "Emergency completed successfully",
                data: emergency,
            });
        } catch (err) {
            console.error("Error completing emergency:", err);
            callback({ status: "error", message: err.message });
        }
    });

    socket.on("initiateChat", async (intiateChatPayload, callback) => {
        try {
            const prompt = `You are a helpful assistant for Wezi Medical Centre only.
        Focus on enquiries about services (Outpatient, Inpatient, Emergency, Antenatal, Theatre), navigation, and bookings.
        Do not discuss unrelated topics.`;
        } catch (error) {
            callback({ status: "error", message: err.message });
        }
    });

    socket.on("disconnect", () => {
        if (userId && userSocketMap[userId]) {
            delete userSocketMap[userId];
        }
    });
});

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
