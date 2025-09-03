// services/serviceService.js - Complete CRUD operations

const Services = require("../models/servicesModel");
const Department = require("../models/departmentModel");

// Get all services
const getAllServices = async () => {
    try {
        const services = await Services.find({ })
            .populate("departmentId", "name description")
            .sort({ createdAt: -1 });

        if (!services) {
            return [];
        }

        // Map the services to include department name for easier frontend handling
        const servicesWithDepartment = services.map(service => ({
            id: service._id,
            name: service.name,
            description: service.description || "",
            isEmergencyService: service.isEmergencyService,
            departmentId: service.departmentId._id,
            department: service.departmentId.name,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        }));

        return servicesWithDepartment;
    } catch (error) {
        console.error("Get all services error:", error);
        return { error: error.message };
    }
};

// Create a new service
const createService = async (data) => {
    try {
        // Validate required fields
        if (!data.name || !data.departmentId) {
            return { error: "Name and Department are required fields" };
        }

        // Check if department exists
        const departmentExists = await Department.findById(data.departmentId);
        if (!departmentExists) {
            return { error: "Invalid department ID - department does not exist" };
        }

        // Check if service with same name already exists in the same department
        const existingService = await Services.findOne({
            name: data.name.trim(),
            departmentId: data.departmentId
        });

        if (existingService) {
            return { error: "A service with this name already exists in the selected department" };
        }

        // Create new service
        const newService = new Services({
            name: data.name.trim(),
            description: data.description ? data.description.trim() : "",
            departmentId: data.departmentId,
            isEmergencyService: data.isEmergencyService || false
        });

        // Save and populate department info
        const savedService = await newService.save();
        const populatedService = await Services.findById(savedService._id)
            .populate("departmentId", "name description");

        // Return formatted service data
        return {
            id: populatedService._id,
            name: populatedService.name,
            description: populatedService.description,
            isEmergencyService: populatedService.isEmergencyService,
            departmentId: populatedService.departmentId._id,
            department: populatedService.departmentId.name,
            createdAt: populatedService.createdAt,
            updatedAt: populatedService.updatedAt
        };

    } catch (error) {
        console.error("Create service error:", error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return { error: "Service with this name already exists" };
        }
        if (error.name === 'ValidationError') {
            const errorMessage = Object.values(error.errors)[0]?.message || error.message;
            return { error: errorMessage };
        }
        if (error.name === 'CastError') {
            return { error: "Invalid department ID provided" };
        }

        return { error: error.message };
    }
};

// Get a single service by ID
const getOneService = async (id) => {
    try {
        if (!id) {
            return { error: "Service ID is required" };
        }

        const service = await Services.findById(id)
            .populate("departmentId", "name description");

        if (!service) {
            return { error: "Service not found" };
        }

        // Return formatted service data
        return {
            id: service._id,
            name: service.name,
            description: service.description,
            isEmergencyService: service.isEmergencyService,
            departmentId: service.departmentId._id,
            department: service.departmentId.name,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        };

    } catch (error) {
        console.error("Get one service error:", error);
        if (error.name === 'CastError') {
            return { error: "Invalid service ID format" };
        }
        return { error: error.message };
    }
};

// Update a service
const updateServices = async (id, data) => {
    try {
        if (!id) {
            return { error: "Service ID is required" };
        }

        // Remove empty or undefined fields
        const updateData = Object.keys(data).reduce((acc, key) => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                acc[key] = data[key];
            }
            return acc;
        }, {});

        // If departmentId is being updated, check if it exists
        if (updateData.departmentId) {
            const departmentExists = await Department.findById(updateData.departmentId);
            if (!departmentExists) {
                return { error: "Invalid department ID - department does not exist" };
            }
        }

        // If name is being updated, check for duplicates in the same department
        if (updateData.name) {
            const currentService = await Services.findById(id);
            if (!currentService) {
                return { error: "Service not found" };
            }

            const departmentId = updateData.departmentId || currentService.departmentId;
            const existingService = await Services.findOne({
                name: updateData.name.trim(),
                departmentId: departmentId,
                _id: { $ne: id } // Exclude current service from check
            });

            if (existingService) {
                return { error: "A service with this name already exists in the selected department" };
            }
            updateData.name = updateData.name.trim();
        }

        if (updateData.description) {
            updateData.description = updateData.description.trim();
        }

        const updatedService = await Services.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true, // Return updated document
                runValidators: true // Run schema validations
            }
        ).populate("departmentId", "name description");

        if (!updatedService) {
            return { error: "Service not found or failed to update" };
        }

        // Return formatted service data
        return {
            id: updatedService._id,
            name: updatedService.name,
            description: updatedService.description,
            isEmergencyService: updatedService.isEmergencyService,
            departmentId: updatedService.departmentId._id,
            department: updatedService.departmentId.name,
            createdAt: updatedService.createdAt,
            updatedAt: updatedService.updatedAt
        };

    } catch (error) {
        console.error("Update service error:", error);
        if (error.name === 'CastError') {
            return { error: "Invalid service ID format" };
        }
        if (error.name === 'ValidationError') {
            const errorMessage = Object.values(error.errors)[0]?.message || error.message;
            return { error: errorMessage };
        }
        if (error.code === 11000) {
            return { error: "Service with this name already exists" };
        }
        return { error: error.message };
    }
};

// Delete a service
const deleteService = async (id) => {
    try {
        if (!id) {
            return { error: "Service ID is required" };
        }

        const deletedService = await Services.findByIdAndDelete(id);

        if (!deletedService) {
            return { error: "Service not found" };
        }

        return { 
            message: "Service deleted successfully",
            deletedService: {
                id: deletedService._id,
                name: deletedService.name
            }
        };

    } catch (error) {
        console.error("Delete service error:", error);
        if (error.name === 'CastError') {
            return { error: "Invalid service ID format" };
        }
        return { error: error.message };
    }
};

// Get services by department
const getServicesByDepartment = async (departmentId) => {
    try {
        if (!departmentId) {
            return { error: "Department ID is required" };
        }

        // Check if department exists
        const departmentExists = await Department.findById(departmentId);
        if (!departmentExists) {
            return { error: "Department not found" };
        }

        const services = await Services.find({ departmentId })
            .populate("departmentId", "name description")
            .sort({ createdAt: -1 });

        const servicesWithDepartment = services.map(service => ({
            id: service._id,
            name: service.name,
            description: service.description,
            isEmergencyService: service.isEmergencyService,
            departmentId: service.departmentId._id,
            department: service.departmentId.name,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        }));

        return servicesWithDepartment;

    } catch (error) {
        console.error("Get services by department error:", error);
        if (error.name === 'CastError') {
            return { error: "Invalid department ID format" };
        }
        return { error: error.message };
    }
};

// Get emergency services only
const getEmergencyServices = async () => {
    try {
        const emergencyServices = await Services.find({ isEmergencyService: true })
            .populate("departmentId", "name description")
            .sort({ createdAt: -1 });

        const servicesWithDepartment = emergencyServices.map(service => ({
            id: service._id,
            name: service.name,
            description: service.description,
            isEmergencyService: service.isEmergencyService,
            departmentId: service.departmentId._id,
            department: service.departmentId.name,
            createdAt: service.createdAt,
            updatedAt: service.updatedAt
        }));

        return servicesWithDepartment;

    } catch (error) {
        console.error("Get emergency services error:", error);
        return { error: error.message };
    }
};

module.exports = {
    getAllServices,
    createService,
    getOneService,
    updateServices,
    deleteService,
    getServicesByDepartment,
    getEmergencyServices
};