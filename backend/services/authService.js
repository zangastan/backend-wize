const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Patient = require("../models/patientsModel");

/**
 * Authenticate user and generate JWT
 */
const login = async (username, password) => {
    try {
        const user = await User.findOne({
            username,
            status: 'active'
        }).select("+password");

        if (!user) {
            throw new Error("User not found");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error("Invalid credentials");
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            {
                id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
            },
            process.env.JWT_SECRET || "guest",
            { expiresIn: "57h" }
        );

        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                username: user.username,
                role: user.role,
            },
            token,
        };
    } catch (error) {
        return { error: error.message };
    }
};

/**
 * Register new user
 */
const register = async (userData) => {
    try {
        const existingUser = await User.findOne({ username: userData.username });
        if (existingUser) {
            throw new Error("Username already exists");
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        userData.password = hashedPassword;
        const newPatient = new Patient();
        await newPatient.save();
        userData.linkedPatientId = newPatient._id;
        const newUser = new User(userData);
        await newUser.save();
        const token = jwt.sign(
            {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.newUsername,
                role: newUser.role,
            },
            process.env.JWT_SECRET || "guest",
            { expiresIn: "57h" }
        );

        return {
            user: {
                id: newUser._id,
                email: newUser.email,
                name: newUser.name,
                username: newUser.newUsername,
                role: newUser.role,
            },
            token,
        };
    } catch (error) {
        return { error: error.message };
    }
};

module.exports = {
    login,
    register,
};
