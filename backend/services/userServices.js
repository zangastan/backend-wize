const User = require("../models/userModel");
const Patient = require("../models/patientsModel");
const Staff = require("../models/staffModel");

// new user creation
// new user creation
const createUser = async (userData) => {
    try {
        let newUser;

        if (userData.role === 'patient') {
            // create patient
            const newPatient = new Patient();
            await newPatient.save();

            // link patient to user
            userData.linkedPatientId = newPatient._id;

        } else if (userData.role === 'staff') {
            // create staff
            const newStaff = new Staff();
            await newStaff.save();

            // link staff to user
            userData.linkedStaffId = newStaff._id;
        }

        // create user with linked IDs
        newUser = new User(userData);
        await newUser.save();

        return newUser;
    } catch (error) {
        console.error("Error creating user:", error);
        return { error: error.message };
    }
};


// return all the users in the system
const getAllUsers = async (filter = {}) => {
    try {
        const users = await User.find(filter)
            .populate('linkedPatientId')
            .populate('linkedStaffId')
            .populate('departmentId');

        if (!users) {
            throw new Error("No users found")
        }
        return users;
    } catch (error) {
        return { error: error.message }
    }
}

// get a user by  id
const getUserById = async (userId) => {
    try {
        const user = await User.find({ username: userId })
        if (!user) {
            throw new Error("User not found")
        }

        return user;
    } catch (error) {
        return { error: error.message }
    }
}

// update the user details
const updateUser = async (userId, updateData) => {
    try {
        const updateData = await User.findOneAndUpdate({ username: userId }
            , updateData,
            { new: true }
        ).select('-password');
        if (!updateData) {
            throw new Error("User not found or update failed")
        }
        return updateData;
    } catch (error) {
        return { error: error.message }
    }
}

// delete a user by user id
const deleteUser = async (userId) => {
    return NotImplementedError
}

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
}

