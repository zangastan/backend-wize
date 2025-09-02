require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { body, param } = require("express-validator");
const { sendMail } = require("./utils/sendMail");
const app = express();

// SERVICES
const userService = require("./services/userServices");
const authService = require("./services/authService");
const validate = require("./middleware/validate");
const AppointmentServices = require("./services/appointementsService");
const departmentService = require("./services/departmentService");
// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
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

// --- USERS ROUTES ADMINS ONLY ROUTES--- //

// Get all users
app.get("/api/allusers", auth, async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single user by ID
app.get(
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
app.put(
    "/api/updateUser/:id",
    [
        param("id").notEmpty().withMessage("Invalid user ID"),
        body("username").optional().notEmpty().withMessage("Username cannot be empty"),
        body("email").optional().isEmail().withMessage("Valid email required"),
        body("role").optional().notEmpty().withMessage("Role cannot be empty"),
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

// Create a new user
app.post(
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
app.put(
    "/api/softDeleteUser/:id",
    [param("id").notEmpty().withMessage("Invalid user ID")],
    validate,
    auth,
    async (req, res) => {
        try {
            await userService.deleteUser(req.params.id);
            return res.status(200).json({ message: "User soft-deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// --- AUTH ROUTES --- //

// Login
app.post(
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
app.post(
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
app.post("/api/create-appointment", auth, async (req, res) => {
    try {
        const newAppointment = await AppointmentServices.createAppointment(req.body);
        if (newAppointment.error) {
            return res.status(400).json({ error: newAppointment.error });
        }
        return res.status(201).json(newAppointment);
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})

//approve appointment
app.put("/api/approve-appointment/:id", auth, async (req, res) => {
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

// -- DEPARTMENTS -- //

//create a new department
app.post("/api/create-department", auth, async (req, res) => {
    try {
        const newDepartment = await departmentService.createDepartment(req.body);
        return res.status(200).json(newDepartment)
    } catch (error) {
        console.log(error.message)
        return res.status(500).json(error.message)
    }
})

// get all departments
app.get("/api/all-departments", auth, async (req, res) => {
    try {
        const departments = departmentService.getAllDepartments();
        return res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

//update the departments 
app.put("/api/update-department/:id", auth, async (req, res) => {
    try {
        const updatedDepartment = await DepartmentService.updateDepartment(req.params.id, req.body);
        return res.status(200).json(updatedDepartment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

// -- SERVICES -- //
// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Error:", err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
