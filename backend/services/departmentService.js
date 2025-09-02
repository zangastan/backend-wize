const department = require("../models/departmentModel");
const Staff = require("../models/staffModel");

const createDepartment = async (data) => {
    try {
        const newDepartment = new department(data)
        await newDepartment.save()
        return newDepartment
    } catch (error) {
        return { error: error.message }
    }
}

const getAllDepartments = async () => {
    try {
        const departments = await department.find({})
        if (!departments) {
            throw new Error("No departments found")
        }
        return departments;
    } catch (error) {
        return { error: error.message }
    }
};

const updateDepartment = async (departmentId, data) => {
    try {
        const department = await department.findByIdAndUpdate(
            { _id: departmentId },
            data, { new: true });

        if (!department) {
            throw new Error("department not found");
        }

        return department;
    } catch (error) {
        return { error: error.message }
    }
}

module.exports = {
    createDepartment,
    updateDepartment,
    getAllDepartments
}