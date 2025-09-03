const emergency = require("../models/emergencies");

// Fetch active emergency for patients
const patientEmergencies = async (id, userType) => {
  try {
    const filter =
      userType === "guest"
        ? { userDeviceId: id, status: { $ne: "completed" } }
        : { sender: id, status: { $ne: "completed" } };

    const patientEmergency = await emergency
      .findOne(filter)
      .populate("assignedTo sender");

    return patientEmergency;
  } catch (error) {
    console.error("Error in patientEmergencies:", error);
    throw new Error("Failed to fetch patient emergencies");
  }
};

// Get past patient emergencies
const pastPatientEmergencies = async (id, userType) => {
  try {
    const filter = userType === "guest" ? { userDeviceId: id } : { sender: id };

    const pastPatientEmergencies = await emergency
      .findOne(filter)
      .populate("assignedTo sender");

    return pastPatientEmergencies;
  } catch (error) {
    console.error("Error in patientEmergencies:", error);
    throw new Error("Failed to fetch past patient emergencies");
  }
};

// Fetch active emergency for ambulance drivers
const ActiveAmbulanceEmergency = async (id) => {
  try {
    const activeEmergency = await emergency
      .findOne({ assignedTo: id, status: { $ne: "completed" } })
      .populate("sender assignedTo");

    return activeEmergency;
  } catch (error) {
    console.error("rror in ActiveAmbulanceEmergency:", error);
    throw new Error("Failed to fetch active ambulance emergency");
  }
};

// Fetch all emergencies for a driver
const driverEmergencies = async (driverId) => {
  try {
    const emergencies = await emergency
      .find({ assignedTo: driverId })
      .populate("sender", "name email role")
      .sort({ createdAt: -1 });

    return emergencies;
  } catch (error) {
    console.error("Error in driverEmergencies:", error);
    throw new Error("Failed to fetch driver emergencies");
  }
};

module.exports = {
  ActiveAmbulanceEmergency,
  patientEmergencies,
  driverEmergencies,
  pastPatientEmergencies,
};
