const Emergency = require("../models/emergencies");
const DriverLocation = require("../models/driverLocation");
const User = require("../models/userModel");

// Clinic center coordinates (you should set these to your actual clinic location)
const CLINIC_CENTER = {
  lat: -11.4567, // Replace with your clinic's latitude
  lng: 34.0123   // Replace with your clinic's longitude
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Calculate driver status based on location and current assignments
const calculateDriverStatus = async (driverId, currentLocation) => {
  const distanceFromClinic = calculateDistance(
    currentLocation.lat, 
    currentLocation.lng,
    CLINIC_CENTER.lat, 
    CLINIC_CENTER.lng
  );

  // Check active emergencies
  const activeEmergencies = await Emergency.countDocuments({
    assignedTo: driverId,
    status: { $in: ['assigned', 'enroute'] }
  });

  if (distanceFromClinic <= 0.5) { // Within 500m of clinic
    return activeEmergencies > 0 ? 'AT_CLINIC_BUSY' : 'AVAILABLE_AT_CLINIC';
  } else if (activeEmergencies === 0) {
    return 'AVAILABLE_NEARBY';
  } else {
    return 'BUSY_ON_ROUTE';
  }
};

// Smart driver selection algorithm
const findBestDriverForEmergency = async (emergencyLocation, priority = 'MEDIUM') => {
  try {
    // Get all online drivers with their locations
    const onlineDrivers = await DriverLocation.find({ isOnline: true })
      .populate('driverId', 'full_name email role');

    if (onlineDrivers.length === 0) {
      return { error: 'No drivers are currently online' };
    }

    const scoredDrivers = [];

    for (const driverLoc of onlineDrivers) {
      // Skip if driver is not actually a driver/ambulance staff
      if (!driverLoc.driverId || driverLoc.driverId.role !== 'staff') continue;

      const distance = calculateDistance(
        driverLoc.currentLocation.lat,
        driverLoc.currentLocation.lng,
        emergencyLocation.lat,
        emergencyLocation.lng
      );

      // Get driver's current workload
      const activeEmergencies = await Emergency.find({
        assignedTo: driverLoc.driverId._id,
        status: { $in: ['assigned', 'enroute'] }
      });

      const status = await calculateDriverStatus(
        driverLoc.driverId._id,
        driverLoc.currentLocation
      );

      let score = 100;

      // Distance penalty (closer is better)
      score -= (distance * 10);

      // Status bonuses/penalties
      if (status === 'AVAILABLE_AT_CLINIC') score += 30;
      else if (status === 'AVAILABLE_NEARBY') score += 20;
      else if (status === 'AT_CLINIC_BUSY') score += 5;
      
      // Workload penalty
      score -= (activeEmergencies.length * 15);

      // Priority bonus for critical emergencies
      if (priority === 'CRITICAL' && distance < 5) score += 25;

      scoredDrivers.push({
        driver: driverLoc.driverId,
        driverLocation: driverLoc,
        distance,
        score: Math.max(score, 0),
        activeEmergencies: activeEmergencies.length,
        status
      });
    }

    // Sort by score (highest first)
    scoredDrivers.sort((a, b) => b.score - a.score);

    return scoredDrivers.length > 0 ? scoredDrivers[0] : { error: 'No suitable driver found' };
  } catch (error) {
    console.error('Error in findBestDriverForEmergency:', error);
    return { error: error.message };
  }
};

// Update driver location
const updateDriverLocation = async (driverId, location, additionalData = {}) => {
  try {
    const updatedLocation = await DriverLocation.findOneAndUpdate(
      { driverId },
      {
        currentLocation: location,
        lastUpdated: new Date(),
        isOnline: true,
        ...additionalData
      },
      { upsert: true, new: true }
    ).populate('driverId', 'full_name role');

    return updatedLocation;
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

// Get all active emergencies with driver locations
const getActiveEmergenciesWithLocations = async () => {
  try {
    const activeEmergencies = await Emergency.find({
      status: { $in: ['assigned', 'enroute', 'onHold'] }
    })
    .populate('sender', 'full_name email')
    .populate('assignedTo', 'full_name email')
    .sort({ createdAt: -1 });

    // Get driver locations for assigned emergencies
    const emergenciesWithDriverLocs = await Promise.all(
      activeEmergencies.map(async (emergency) => {
        let driverLocation = null;
        if (emergency.assignedTo) {
          driverLocation = await DriverLocation.findOne({
            driverId: emergency.assignedTo._id
          });
        }
        
        return {
          ...emergency.toObject(),
          driverLocation: driverLocation ? {
            lat: driverLocation.currentLocation.lat,
            lng: driverLocation.currentLocation.lng,
            lastUpdated: driverLocation.lastUpdated,
            isOnline: driverLocation.isOnline
          } : null
        };
      })
    );

    return emergenciesWithDriverLocs;
  } catch (error) {
    console.error('Error getting active emergencies with locations:', error);
    throw error;
  }
};

module.exports = {
  calculateDistance,
  findBestDriverForEmergency,
  updateDriverLocation,
  getActiveEmergenciesWithLocations,
  calculateDriverStatus,
  CLINIC_CENTER
};