// server/enhanced-location-tracking.js

// Enhanced distance calculation function (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
};

// Enhanced ETA calculation with traffic considerations
const calculateETA = (driverLocation, patientLocation, currentSpeed = 0, timeOfDay = new Date()) => {
    const distance = calculateDistance(
        driverLocation.lat, 
        driverLocation.lng,
        patientLocation.lat, 
        patientLocation.lng
    );
    
    // Dynamic speed calculation based on current speed and time
    let avgSpeed = 35; // Default average speed in km/h
    
    if (currentSpeed > 5) {
        // Use current speed if driver is moving, with some adjustments
        avgSpeed = Math.min(currentSpeed * 0.8, 60); // Account for stops, traffic lights, etc.
    } else {
        // Adjust for time of day when stationary
        const hour = timeOfDay.getHours();
        if (hour >= 7 && hour <= 9) avgSpeed = 25; // Morning rush
        else if (hour >= 17 && hour <= 19) avgSpeed = 25; // Evening rush
        else if (hour >= 22 || hour <= 6) avgSpeed = 45; // Night time
    }
    
    const timeInHours = distance / avgSpeed;
    const timeInMinutes = Math.ceil(timeInHours * 60);
    return Math.max(1, timeInMinutes); // Minimum 1 minute
};

// Enhanced updateDriverLocation function
const updateDriverLocation = async (driverId, location, additionalData = {}) => {
    try {
        const updateData = {
            currentLocation: {
                lat: parseFloat(location.lat),
                lng: parseFloat(location.lng)
            },
            lastUpdated: new Date(),
            isOnline: true,
            currentSpeed: additionalData.currentSpeed || 0,
            heading: additionalData.heading || 0,
            accuracy: additionalData.accuracy || 0
        };

        const updatedLocation = await DriverLocation.findOneAndUpdate(
            { driverId },
            updateData,
            { new: true, upsert: true }
        ).populate('driverId', 'full_name role phone');

        return updatedLocation;
    } catch (error) {
        console.error('Error updating driver location:', error);
        throw error;
    }
};

// Enhanced socket connection handling
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Enhanced driver location update with real-time calculations
    socket.on("updateDriverLocation", async (locationData, callback) => {
        const { driverId, location, speed, heading, accuracy, timestamp } = locationData;

        try {
            // Update driver location in database
            const updatedLocation = await updateDriverLocation(driverId, location, {
                currentSpeed: speed || 0,
                heading: heading || 0,
                accuracy: accuracy || 0
            });

            // Find all active emergencies assigned to this driver
            const activeEmergencies = await Emergency.find({
                assignedTo: driverId,
                status: { $in: ['assigned', 'enroute'] }
            }).populate('sender');

            // Calculate real-time data for each emergency
            const emergencyUpdates = [];
            
            for (const emergency of activeEmergencies) {
                const patientLocation = {
                    lat: emergency.locationLat,
                    lng: emergency.locationLang
                };

                const distance = calculateDistance(
                    location.lat, location.lng,
                    patientLocation.lat, patientLocation.lng
                );

                const eta = calculateETA(
                    location, 
                    patientLocation, 
                    speed || 0, 
                    new Date()
                );

                const updateData = {
                    emergencyId: emergency._id,
                    driverLocation: {
                        lat: location.lat,
                        lng: location.lng,
                        lastUpdated: new Date().toISOString(),
                        speed: speed || 0,
                        accuracy: accuracy || 0
                    },
                    distance: distance,
                    estimatedArrival: eta,
                    driverInfo: {
                        name: updatedLocation.driverId.full_name,
                        phone: updatedLocation.driverId.phone
                    }
                };

                emergencyUpdates.push({
                    emergency,
                    updateData
                });

                // Send update to patient if they're registered and connected
                if (emergency.userType === 'registred' && emergency.sender && userSocketMap[emergency.sender._id]) {
                    io.to(userSocketMap[emergency.sender._id]).emit('driverLocationUpdate', updateData);
                }

                // Send update to anonymous users if they have device ID
                if (emergency.userType === 'anonymous' && emergency.userDeviceId && deviceSocketMap[emergency.userDeviceId]) {
                    io.to(deviceSocketMap[emergency.userDeviceId]).emit('driverLocationUpdate', updateData);
                }
            }

            // Broadcast to admin dashboard with enhanced data
            socket.broadcast.to('admin-dashboard').emit('driverLocationUpdate', {
                driverId,
                driverName: updatedLocation.driverId.full_name,
                location: {
                    lat: location.lat,
                    lng: location.lng
                },
                speed: speed || 0,
                heading: heading || 0,
                accuracy: accuracy || 0,
                lastUpdated: new Date().toISOString(),
                activeEmergencies: emergencyUpdates.length,
                emergencyDetails: emergencyUpdates.map(eu => ({
                    emergencyId: eu.emergency._id,
                    patientName: eu.emergency.sender?.name || 'Anonymous',
                    distance: eu.updateData.distance,
                    eta: eu.updateData.estimatedArrival
                }))
            });

            callback({ 
                status: 'success', 
                location: updatedLocation,
                emergenciesUpdated: emergencyUpdates.length,
                message: `Location updated successfully. ${emergencyUpdates.length} emergency(ies) notified.`
            });

        } catch (error) {
            console.error('Error updating driver location:', error);
            callback({ 
                status: 'error', 
                message: error.message 
            });
        }
    });

    // Enhanced emergency tracking endpoint
    socket.on("getEmergencyTracking", async (emergencyId, callback) => {
        try {
            const emergency = await Emergency.findById(emergencyId)
                .populate('sender assignedTo');

            if (!emergency) {
                return callback({ status: 'error', message: 'Emergency not found' });
            }

            let trackingData = {
                emergency: emergency.toObject(),
                patientLocation: {
                    lat: emergency.locationLat,
                    lng: emergency.locationLang
                },
                driverLocation: null,
                realTimeData: null
            };

            // Get driver location if assigned
            if (emergency.assignedTo) {
                const driverLoc = await DriverLocation.findOne({
                    driverId: emergency.assignedTo._id,
                    isOnline: true
                });

                if (driverLoc) {
                    const distance = calculateDistance(
                        driverLoc.currentLocation.lat,
                        driverLoc.currentLocation.lng,
                        emergency.locationLat,
                        emergency.locationLang
                    );

                    const eta = calculateETA(
                        driverLoc.currentLocation,
                        { lat: emergency.locationLat, lng: emergency.locationLang },
                        driverLoc.currentSpeed
                    );

                    trackingData.driverLocation = {
                        lat: driverLoc.currentLocation.lat,
                        lng: driverLoc.currentLocation.lng,
                        lastUpdated: driverLoc.lastUpdated.toISOString(),
                        speed: driverLoc.currentSpeed,
                        accuracy: driverLoc.accuracy,
                        isOnline: driverLoc.isOnline
                    };

                    trackingData.realTimeData = {
                        distance,
                        estimatedArrival: eta,
                        isTracking: true
                    };
                }
            }

            callback({ status: 'success', data: trackingData });

        } catch (error) {
            console.error('Error getting emergency tracking:', error);
            callback({ status: 'error', message: error.message });
        }
    });

    // Start live tracking for a specific emergency
    socket.on("startLiveTracking", async (emergencyId, callback) => {
        try {
            const emergency = await Emergency.findById(emergencyId);
            if (emergency && emergency.assignedTo) {
                socket.join(`tracking-${emergencyId}`);
                callback({ status: 'success', message: 'Live tracking started' });
            } else {
                callback({ status: 'error', message: 'No driver assigned to this emergency' });
            }
        } catch (error) {
            callback({ status: 'error', message: error.message });
        }
    });

    // Stop live tracking
    socket.on("stopLiveTracking", (emergencyId, callback) => {
        socket.leave(`tracking-${emergencyId}`);
        callback({ status: 'success', message: 'Live tracking stopped' });
    });

    // Enhanced driver availability toggle
    socket.on("toggleDriverAvailability", async (driverId, isOnline, callback) => {
        try {
            await DriverLocation.findOneAndUpdate(
                { driverId },
                { 
                    isOnline,
                    lastUpdated: new Date()
                },
                { new: true, upsert: true }
            );

            // Notify admin dashboard
            io.to('admin-dashboard').emit('driverAvailabilityChanged', {
                driverId,
                isOnline,
                timestamp: new Date().toISOString()
            });

            callback({ status: 'success', isOnline });
        } catch (error) {
            callback({ status: 'error', message: error.message });
        }
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Clean up socket mappings
        Object.keys(userSocketMap).forEach(userId => {
            if (userSocketMap[userId] === socket.id) {
                delete userSocketMap[userId];
            }
        });

        Object.keys(deviceSocketMap).forEach(deviceId => {
            if (deviceSocketMap[deviceId] === socket.id) {
                delete deviceSocketMap[deviceId];
            }
        });
    });
});

// REST API endpoints for emergency tracking
server.get("/api/emergency/:id/live-tracking", async (req, res) => {
    try {
        const emergencyId = req.params.id;
        const emergency = await Emergency.findById(emergencyId)
            .populate('sender assignedTo');

        if (!emergency) {
            return res.status(404).json({ error: 'Emergency not found' });
        }

        let responseData = {
            emergency: emergency.toObject(),
            patientLocation: {
                lat: emergency.locationLat,
                lng: emergency.locationLang
            },
            driverLocation: null,
            realTimeMetrics: null
        };

        if (emergency.assignedTo) {
            const driverLocation = await DriverLocation.findOne({
                driverId: emergency.assignedTo._id
            });

            if (driverLocation && driverLocation.isOnline) {
                const distance = calculateDistance(
                    driverLocation.currentLocation.lat,
                    driverLocation.currentLocation.lng,
                    emergency.locationLat,
                    emergency.locationLang
                );

                const eta = calculateETA(
                    driverLocation.currentLocation,
                    { lat: emergency.locationLat, lng: emergency.locationLang },
                    driverLocation.currentSpeed
                );

                responseData.driverLocation = {
                    lat: driverLocation.currentLocation.lat,
                    lng: driverLocation.currentLocation.lng,
                    lastUpdated: driverLocation.lastUpdated,
                    speed: driverLocation.currentSpeed,
                    heading: driverLocation.heading,
                    accuracy: driverLocation.accuracy,
                    isOnline: driverLocation.isOnline
                };

                responseData.realTimeMetrics = {
                    distance: distance,
                    estimatedArrival: eta,
                    averageSpeed: driverLocation.currentSpeed > 0 ? driverLocation.currentSpeed : 35,
                    isLiveTracking: true,
                    lastCalculated: new Date().toISOString()
                };
            }
        }

        res.json({
            status: 'success',
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching live tracking data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Batch update for multiple drivers
server.post("/api/drivers/batch-location-update", async (req, res) => {
    try {
        const { updates } = req.body; // Array of { driverId, location, speed, etc. }
        const results = [];

        for (const update of updates) {
            try {
                const result = await updateDriverLocation(
                    update.driverId, 
                    update.location, 
                    {
                        currentSpeed: update.speed || 0,
                        heading: update.heading || 0,
                        accuracy: update.accuracy || 0
                    }
                );
                results.push({ driverId: update.driverId, status: 'success', data: result });
            } catch (err) {
                results.push({ driverId: update.driverId, status: 'error', message: err.message });
            }
        }

        res.json({ status: 'success', results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = {
    calculateDistance,
    calculateETA,
    updateDriverLocation
};