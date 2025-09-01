require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const userService = require("./services/userServices");

// JWT Auth Middleware
const auth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'Missing authorization header' });
    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// --- USERS ROUTE --- //

/* get all the users for the admin route */
app.get("/api/allusers", auth, async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.get("/api/getUser/:id", auth, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await userService.getUserById(userId);
        res.json(user)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// update a single user details
app.put("/api/updateUser/:id", auth, async (req, res) => {
    try {
        const userId = req.params.id;
        const updateData = req.body;
        const updatedUser = await userService.updateUser(userId, updateData);
        return res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// route to create a new user 
app.post("/api/createUser", async (req, res) => {
    try {
        const userData = req.body;
        const newUser = await userService.createUser(userData);
        return res.json(newUser)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
