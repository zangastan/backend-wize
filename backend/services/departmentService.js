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
        console.log("Updating department:", departmentId);

        const updatedDepartment = await department.findByIdAndUpdate(
            departmentId,
            { $set: data }, // ensures partial updates
            { new: true, runValidators: true } // return updated doc + validate schema
        );

        if (!updatedDepartment) {
            throw new Error("Department not found");
        }

        return updatedDepartment;
    } catch (error) {
        console.error("Update error:", error);
        return { error: error.message };
    }
};

module.exports = {
    createDepartment,
    updateDepartment,
    getAllDepartments
}