const department = require("../models/departmentModel");
const Staff = require("../models/staffModel");

const createDepartment = async (data) => {
  try {
    const newDepartment = new department(data);
    await newDepartment.save();
    console.log(`New Department: ${newDepartment}`);
    return newDepartment;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

const getAllDepartments = async () => {
  try {
    const departments = await department.find({});
    if (!departments) {
      throw new Error("No departments found");
    }
    return departments;
  } catch (error) {
    return { error: error.message };
  }
};

const updateDepartment = async (departmentId, data) => {
  try {
    const updatedDepartment = await department.findByIdAndUpdate(
      departmentId,
      data,
      { new: true }
    );

    if (!updatedDepartment) {
      throw new Error("department not found");
    }

    return updatedDepartment;
  } catch (error) {
    console.log(error)
    return { error: error.message };
  }
};

const deleteDepartment = async (id) => {
  try {
    const deletedDepartment = await department.findByIdAndDelete(id);

    if (!deletedDepartment) {
      throw new Error("Service not found");
    }

    return deletedDepartment;
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  createDepartment,
  updateDepartment,
  getAllDepartments,
  deleteDepartment,
};
