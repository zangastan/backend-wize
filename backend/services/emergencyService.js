const Emergency = require("../models/emergencies");
const DriverLocation = require("../models/driverLocation");
const User = require("../models/userModel");

// Clinic center coordinates
const CLINIC_CENTER = { lat: -11.4567, lng: 34.0123 };

// Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Driver status
const calculateDriverStatus = async (driverId, currentLocation) => {
  const distanceFromClinic = calculateDistance(
    currentLocation.lat, currentLocation.lng,
    CLINIC_CENTER.lat, CLINIC_CENTER.lng
  );

  const activeEmergencies = await Emergency.countDocuments({
    assignedTo: driverId,
    status: { $in: ["assigned", "enroute"] }
  });

  if (distanceFromClinic <= 0.5) return activeEmergencies ? "AT_CLINIC_BUSY" : "AVAILABLE_AT_CLINIC";
  if (!activeEmergencies) return "AVAILABLE_NEARBY";
  return "BUSY_ON_ROUTE";
};

// Find best driver for emergency
const findBestDriverForEmergency = async (emergencyLocation, priority = "MEDIUM") => {
  try {
    const onlineDrivers = await DriverLocation.find({ isOnline: true })
      .populate("driverId", "full_name role");

    if (!onlineDrivers.length) return { error: "No drivers online" };

    const scoredDrivers = [];
    for (const d of onlineDrivers) {
      if (!d.driverId || d.driverId.role !== "staff") continue;

      const distance = calculateDistance(
        d.currentLocation.lat,
        d.currentLocation.lng,
        emergencyLocation.lat,
        emergencyLocation.lng
      );

      const activeEmergencies = await Emergency.countDocuments({
        assignedTo: d.driverId._id,
        status: { $in: ["assigned", "enroute"] }
      });

      const status = await calculateDriverStatus(d.driverId._id, d.currentLocation);

      let score = 100 - (distance * 10) - (activeEmergencies * 15);
      if (status === "AVAILABLE_AT_CLINIC") score += 30;
      else if (status === "AVAILABLE_NEARBY") score += 20;
      else if (status === "AT_CLINIC_BUSY") score += 5;
      if (priority === "CRITICAL" && distance < 5) score += 25;

      scoredDrivers.push({ driver: d.driverId, driverLocation: d, distance, score });
    }

    scoredDrivers.sort((a, b) => b.score - a.score);
    return scoredDrivers[0] || { error: "No suitable driver found" };
  } catch (error) {
    return { error: error.message };
  }
};

// Update driver location
const updateDriverLocation = async (driverId, location, additionalData = {}) => {
  return await DriverLocation.findOneAndUpdate(
    { driverId },
    { currentLocation: location, lastUpdated: new Date(), isOnline: true, ...additionalData },
    { upsert: true, new: true }
  ).populate("driverId", "full_name role");
};

// Get active emergencies with driver locations
const getActiveEmergenciesWithLocations = async () => {
  const emergencies = await Emergency.find({
    status: { $in: ["assigned", "enroute", "onHold"] }
  })
    .populate("sender", "full_name email")
    .populate("assignedTo", "full_name email")
    .sort({ createdAt: -1 });

  return await Promise.all(emergencies.map(async e => {
    let driverLoc = null;
    if (e.assignedTo) driverLoc = await DriverLocation.findOne({ driverId: e.assignedTo._id });
    return {
      ...e.toObject(), driverLocation: driverLoc ? {
        lat: driverLoc.currentLocation.lat,
        lng: driverLoc.currentLocation.lng,
        lastUpdated: driverLoc.lastUpdated,
        isOnline: driverLoc.isOnline,
        speed: driverLoc.currentSpeed
      } : null
    };
  }));
};
const getActiveDriverEmergency = async (driverId) => {
  return await Emergency.findOne({
    assignedTo: driverId,
    status: { $in: ["assigned", "enroute"] }
  }).populate("sender assignedTo");
};

const getUserPast = async (id) => {

  const data = await Emergency.find({ sender: id })
    .populate("assignedTo")
  if (data.error) {
    throw new error(`an error has occured : ${data.error.message}`)
  }

  return data;
}
module.exports = {
  getActiveDriverEmergency,
  calculateDistance,
  calculateDriverStatus,
  findBestDriverForEmergency,
  updateDriverLocation,
  getActiveEmergenciesWithLocations,
  getUserPast,
  CLINIC_CENTER
};
