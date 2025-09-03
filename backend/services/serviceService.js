const services = require("../models/servicesModel");

const getAllSerevices = async () => {
  try {
    const _services = await services.find({}).populate("departmentId");
    // .populate("Department")
    if (!_services) {
      throw new Error("No services found");
    }
    return _services;
  } catch (error) {
    return { error: error.message };
  }
};

// create the new service
const createService = async (data) => {
  try {
    const newService = new services(data);
    newService.save();
    return newService;
  } catch (error) {
    return { error: error.message };
  }
};

const getOneService = async (id) => {
  try {
    const singleService = await services
      .find({ _id: id })
      .populate("Department");
    if (!singleService) {
      throw new Error("failed to get service");
    }

    return singleService;
  } catch (error) {
    return { error: error.message };
  }
};

const updateServices = async (id, data) => {
  try {
    const updatedService = await services
      .findByIdAndUpdate(id, data)
      .populate("departmentId");

    if (!updatedService) {
      console.log(updatedService);
      throw new Error("failed to update the service");
    }

    return updatedService;
  } catch (error) {
    return { error: error.message };
  }
};

const deleteServices = async (id) => {
  try {
    const deletedService = await services.findByIdAndDelete(id);

    if (!deletedService) {
      throw new Error("Service not found");
    }

    return deletedService;
  } catch (error) {
    return { error: error.message };
  }
};

module.exports = {
  getAllSerevices,
  updateServices,
  getOneService,
  createService,
  deleteServices,
};
