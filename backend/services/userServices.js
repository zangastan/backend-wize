const User = require("../models/userModel");
const Patient = require("../models/patientsModel");
const Staff = require("../models/staffModel");
const bcrypt = require('bcryptjs');
const generatePassword = require("../utils/generatepwd");
const { sendMail } = require("../utils/sendMail");
// new user creation

const createUser = async (userData) => {
    const isExiststing = await User.findOne({ username: userData.username })
    if (isExiststing) {
        return { error: "Username already exists" }
    }

    try {
        console.log("user data: ", userData)
        let newUser;
        const generatedpwd = generatePassword(8);
        const hashedPassword = await bcrypt.hash(generatedpwd, 10);
        userData.password = hashedPassword;

        if (userData.role === 'patient') {
            // create patient
            const newPatient = new Patient();
            await newPatient.save();

            // link patient to user
            userData.linkedPatientId = newPatient._id;

        } else if (userData.role === 'doctor' || userData.role === 'nurse' || userData.role === 'ambulance_driver' || userData.role === 'hod') {
            // create staff
            const newStaff = new Staff();
            await newStaff.save();

            // link staff to user
            userData.linkedStaffId = newStaff._id;
        }

        // create user with linked IDs
        newUser = new User(userData);
        await sendMail({
            to: newUser.email,
            subject: 'Your Wezi Clinic Account',
            html: `<div style="
      font-family: Arial, sans-serif; 
      color: #2c3e50; 
      line-height: 1.6; 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
      border: 1px solid #e0e0e0; 

      border-radius: 8px; 
      background-color: #f9f9f9;
    ">
      <h2 style="color: #1abc9c;">Welcome to <strong>Wezi Clinic</strong>!</h2>
      <p>Hello <strong>${newUser.name}</strong>,</p>
      <p>Your account has been created successfully. Here are your login details:</p>
      <p style="background-color: #ecf0f1; padding: 10px; border-radius: 5px;">
        <strong>Username:</strong> ${newUser.username}<br/>
        <strong>Password:</strong> ${generatedpwd}
      </p>
      <p>We’re delighted to have you with us. Feel free to log in and explore our services.</p>
      <p style="margin-top: 30px;">— With warm regards,<br/><em>The Wezi Clinic Team</em></p>
    </div>`
        })
        await newUser.save();


        return newUser;
    } catch (error) {
        console.error("Error creating user:", error.message);
        return { error: error.message };
    }
};

// return all the users in the system
const getAllUsers = async (filter = {}) => {
    filter.status = 'active'; // only active users
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

// return all the users in the system
const tempRole = async (role) => {
    filter.status = 'active'; // only active users
    try {
        const users = await User.find({role})
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

// UPDATE
const updateUser = async (userId, updateData) => {
    try {
        // update the user details 
        const updatedUser = await User.findOneAndUpdate({ username: userId }
            , updateData,
            { new: true }
        ).select('-password');

        // Update linked Patient or Staff details if provided
        if (updateData.address || updateData.nationId || updateData.conditions || updateData.emergencyContact) {
            await Patient.findOneAndUpdate(
                { _id: updatedUser.linkedPatientId },
                updateData,
                { new: true }
            );
        } else if (updateData.specialties || updateData.workingHours) {
            await Staff.findOneAndUpdate(
                { _id: updatedUser.linkedStaffId },
                updateData,
                { new: true }
            );
        }

        if (!updatedUser) {
            throw new Error("User not found or update failed")
        }
        return updatedUser;

    } catch (error) {
        return { error: error.message }
    }
}

// delete a user by user id
const changeUserStatus = async (userId) => {
    try {
        const user = await find({ username: userId })
        if (user.status == "inactive") {
            await User.findOneAndUpdate(
                { username: userId },
                { status: 'inactive' })
        } else {
            await User.findOneAndUpdate(
                { username: userId },
                { status: 'active' })
        }

    } catch (error) {
        return { error: error.message }
    }
}

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    changeUserStatus,
    tempRole,
}

