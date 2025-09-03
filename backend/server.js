require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { body, param } = require("express-validator");
const { sendMail } = require("./utils/sendMail");
const http = require("http");
const morgan = require("morgan");
const Multer = require("multer");
const FormData = require("form-data");
// const app = express();
// const http = require("http");
const { Server } = require("socket.io");

const getLangChainResponse = require("./services/chatbotLogic");
const Chat = require("./models/Chats");
const BookingState = require("./models/BookingState");
const handleBookingFlow = require("./utils/bookingHandler");

// Server setup
const server = express();
const socketServer = http.createServer(server);

const io = new Server(socketServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// socket.io user map
const userSocketMap = {};
const User = require("./models/userModel");
const Department = require("./models/departmentModel");

// SERVICES
const userService = require("./services/userServices");
const authService = require("./services/authService");
const validate = require("./middleware/validate");
const AppointmentServices = require("./services/appointementsService");
const departmentService = require("./services/departmentService");
const serviceServices = require("./services/serviceService");
const getAvailableDriver = require("./utils/getAvailableDriver");
const emergencyService = require("./services/emergencyService");
const { sendEmergencyNotification } = require("./services/emai.service");
const { sendNewEnquiryEmail } = require("./services/emai.service");
const Enquiry = require("./models/Enquiry");
const Emergency = require("./models/emergencies");
// Middleware
server.use(cors());
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(morgan("dev"));
server.get("/", (req, res) => {
  res.send("Welcome to Wezi Clinic API");
});

// JWT Auth Middleware
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ message: "Missing authorization header" });
  const token = header.split(" ")[1];
  try {
    const payload = jwt.decode(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

server.get("/dashboard/:role", auth, async (req, res) => {
  try {
    // Only admin can access
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // Count patients
    const patientsCount = await User.countDocuments({ role: "patient" });

    // Count staff
    const staffCount = await User.countDocuments({ role: "staff" });

    // Count HODs (department heads)
    const hodsCount = await User.countDocuments({ role: "department_head" });

    // Count departments
    const departmentsCount = await Department.countDocuments();

    // Optional: send some user info for the dashboard hero
    const userInfo = await User.findById(req.user.id).select(
      "full_name email role"
    );

    res.json({
      userData: {
        id: userInfo._id,
        full_name: userInfo.full_name,
        email: userInfo.email,
        role: userInfo.role,
      },
      users: {
        patients: patientsCount,
        staff: staffCount,
        hods: hodsCount,
      },
      departments: departmentsCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// --- USERS ROUTES ADMINS ONLY ROUTES--- //

// Get all users
server.get("/api/allusers", auth, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.get("/api/role/:role", async (req, res) => {
  try {
    const users = await userService.tempRole(req.params.role);
    return res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get single user by ID
server.get(
  "/api/getUser/:id",
  [param("id").notEmpty().withMessage("Invalid user ID")],
  validate,
  auth,
  async (req, res) => {
    try {
      const user = await userService.getUserById(req.params.id);
      return res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update a single user
server.put(
  "/api/updateuser/:id",
  [param("id").notEmpty().withMessage("Invalid user ID")],
  validate,
  auth,
  async (req, res) => {
    try {
      const updatedUser = await userService.updateUser(req.params.id, req.body);
      return res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

server.put("/api/changeStatus/:id", async (req, res) => {
  try {
    const updatedUser = await userService.changeUserStatus(req.params.id);
    return res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Create a new user
server.post(
  "/api/create-user",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    // body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const newUser = await userService.createUser(req.body);
      console.log(newUser);

      return res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Soft delete a user
server.put(
  "/api/softDeleteUser/:id",
  [param("id").notEmpty().withMessage("Invalid user ID")],
  validate,
  auth,
  async (req, res) => {
    try {
      await userService.changeUserStatus(req.params.id);
      return res
        .status(200)
        .json({ message: "User soft-deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// get hod staff mambers
server.get("/api/get-department-staff/:hodId", async (req, res) => {
  try {
    const { hodId } = req.params;
    const hodData = await User.findById(hodId);
    const staffMembers = await User.find({
      role: { $in: ["nurse", "doctor", "ambulance_drivers"] },
      departmentId: hodData?.departmentId,
    }).populate("linkedStaffId");
    res.status(200).json(staffMembers);
  } catch (error) {
    res.status(500).json({ status: "failed", error: error.message });
  }
});

// --- AUTH ROUTES --- //

// Login
server.post(
  "/api/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await authService.login(username, password);
      if (user.error) return res.status(400).json({ error: user.error });
      return res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// -- PATIENT ONLY ROUTES -- //
// Register
server.post(
  "/api/register",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validate,
  async (req, res) => {
    try {
      const newUser = await authService.register(req.body);
      if (newUser.error) return res.status(400).json({ error: newUser.error });
      return res.status(201).json(newUser);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// --- APPOINTMENTS ROUTES --- //

//create a new appointment
server.post("/api/create-appointment", async (req, res) => {
  try {
    const newAppointment = await AppointmentServices.createAppointment(
      req.body
    );
    if (newAppointment.error) {
      return res
        .status(400)
        .json({ error: "No doctors available for this service" });
    }
    return res.status(201).json(newAppointment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

//approve appointment
server.put("/api/approve-appointment/:id", async (req, res) => {
  try {
    const appointment = await AppointmentServices.approveAppointment(
      req.params.id
    );
    if (appointment.error) {
      return res.status(400).json({ error: appointment.error });
    }
    return res.status(200).json(appointment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// postpone the apppointement
server.put("/api/postpone-appointment/:id", async (req, res) => {
  try {
    const appointment = await AppointmentServices.moveDate(
      req.params.id,
      req.body
    );
    if (appointment.error) {
      return res.status(400).json({ error: appointment.error });
    }
    return res.status(200).json(appointment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
server.get("/api/get-appointment/:id", async (req, res) => {
  try {
    const appointement = await AppointmentServices.getAllAppointments(
      req.params.id
    );

    if (appointement.error) {
      return res.status(404).json({ error: appointement.error });
    }

    return res.status(200).json(appointement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
server.get("/api/all-appointments/:id", auth, async (req, res) => {
  try {
    // const {role} = req.query;
    console.log(req.query.role);
    const appointments = await AppointmentServices.getAllAppointments(
      req.params.id,
      req.query.role
    );
    if (appointments.error) {
      return res.status(400).json({ error: appointments.error });
    }
    return res.status(200).json(appointments);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
// -- DEPARTMENTS -- //

// get all departments
server.get("/api/all-departments", auth, async (req, res) => {
  try {
    const departments = await departmentService.getAllDepartments();
    return res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//create a new department
server.post("/api/create-department", auth, async (req, res) => {
  try {
    const newDepartment = await departmentService.createDepartment(req.body);
    console.log(`Departments: ${newDepartment}`);
    return res.status(200).json(newDepartment);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(error.message);
  }
});

//update the departments
server.put("/api/update-department/:id", auth, async (req, res) => {
  try {
    const updatedDepartment = await departmentService.updateDepartment(
      req.params.id,
      req.body
    );
    if (departmentService.error) {
      res.status(400).json({ error: departmentService.error });
    }

    return res.status(200).json(updatedDepartment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//deletw department
server.delete("/api/delete-department/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDepartment = await departmentService.deleteDepartment(id);
    return res.status(200).json(deletedDepartment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- SERVICES -- //
server.get("/api/all-services", async (req, res) => {
  try {
    const AllServices = await serviceServices.getAllSerevices();
    if (AllServices.error) {
      return { error: AllServices.error };
    }
    return res.status(200).json(AllServices);
  } catch (error) {
    return { error: error.message };
  }
});

// create a new service
server.post("/api/create-service", auth, async (req, res) => {
  try {
    const newService = await serviceServices.createService(req.body);
    if (newService.error) {
      console.log(newService);
      return { error: newService.error };
    }
    return res.status(200).json(newService);
  } catch (error) {
    return { error: error.message };
  }
});

// update a service
server.put("/api/update-service/:serviceId", auth, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updatedService = await serviceServices.updateServices(
      serviceId,
      req.body
    );
    if (updatedService.error) {
      console.log(updatedService);
      return { error: updatedService.error };
    }
    return res.status(200).json(updatedService);
  } catch (error) {
    return { error: error.message };
  }
});

server.delete("/api/delete-service/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedService = await serviceServices.deleteServices(id);
  } catch (error) {
    res.status(500).json({ status: "failed", error: error?.message });
  }
});

// --- EMERGENCIES --- //
// Get active emergency for patients
server.get("/api/emergency/active/:userType/:id", async (req, res) => {
  try {
    const { userType, id } = req.params;

    const emergency = await emergencyService.patientEmergencies(id, userType);
    if (!emergency) {
      return res.status(404).json({ error: "No active emergency found" });
    }

    return res.status(200).json(emergency);
  } catch (err) {
    console.error("❌ Error fetching active patient emergencies:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get past patient details
server.get("/api/emergency/past/:userType/:id", async (req, res) => {
  try {
    const { userType, id } = req.params;

    const pastPatientEmergencies =
      await emergencyService.pastPatientEmergencies(id, userType);

    return res.status(200).json(pastPatientEmergencies);
  } catch (err) {
    console.error("❌ Error fetching active patient emergencies:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get active emergency for ambulance drivers
server.get("/api/emergency/active/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const emergency = await emergencyService.ActiveAmbulanceEmergency(id);
    if (!emergency) {
      return res.status(404).json({ error: "No active emergency found" });
    }

    return res.status(200).json(emergency);
  } catch (err) {
    console.error("❌ Error fetching active driver emergencies:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get all emergencies for a driver
server.get("/driver/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;

    const emergencies = await emergencyService.driverEmergencies(driverId);
    if (!emergencies || emergencies.length === 0) {
      return res
        .status(404)
        .json({ error: "No emergencies found for this driver" });
    }

    return res.status(200).json(emergencies);
  } catch (err) {
    console.error("❌ Error fetching driver emergencies:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

server.get("/api/user-conversation/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const conversation = await Chat.find({ user: userId }).sort({
      createAt: -1,
    });
    console.log("Conversation: ", conversation);
    res.status(200).json({ status: "success", conversation });
  } catch (error) {
    console.log("API Error:", error);
    res
      .status(500)
      .json({ error: "Failed to get a response from the chatbot." });
  }
});

server.post("/api/chat", async (req, res) => {
  const { message, id, userType } = req.body;
  console.log(req.body);

  if (!message) return res.status(400).json({ error: "Message is required." });

  try {
    // Save user message
    await Chat.create({
      userType,
      ...(userType === "registred" ? { user: id } : { userDeviceId: id }),
      message,
      sender: "user",
    });

    // Check for ongoing booking
    let bookingState = await BookingState.findOne({ userId: id });
    let botReply;
    let state = "chat";

    if (bookingState) {
      // Continue booking flow
      botReply = await handleBookingFlow(message, bookingState, id);
      state = "appointment booking";
    } else {
      // Normal LangChain response for general queries
      const response = await getLangChainResponse(message, userType);

      if (response === "able_to_book") {
        // Start booking flow
        await BookingState.create({ userId: id, step: "waiting_for_service" });

        // Get all services dynamically
        const services = await serviceServices.getAllSerevices();
        const serviceList = services.map((s) => s.name).join(", ");

        botReply = `Which service would you like to book? Available services: ${serviceList}`;
        state = "initialized";
      } else if (response.startsWith("escalate_to_staff")) {
        // Format: escalate_to_staff,<department_code>:<user's query>
        const [, rest] = response.split(","); // "emd: Patient is experiencing chest pains"
        const [deptCode, userQuery] = rest.split(":").map((s) => s.trim());

        const department = await Department.findOne({ code: deptCode });
        botReply = `Your request has been escalated to the ${
          department?.name
        } ${deptCode.toUpperCase()} department.`;

        try {
          if (department) {
            const hod = await User.findOne({
              departmentId: department._id,
              role: "hod",
            });

            if (hod) {
              const hodSocketId = userSocketMap[hod._id];
              const newEnquiry = await Chat.create({
                message: userQuery,
                sender: "user",
                userType,
                ...(userType === "registred"
                  ? { user: id }
                  : { userDeviceId: id }),
                metadata: { escalatedTo: hod._id },
              });

              // const newEnquiry = await Enquiry.create({
              //   senderId: id,
              //   receiverId: hod?._id,
              //   timestamp: new Date(),
              //   text: userQuery,
              //   sender: "patient",
              // });
              if (hodSocketId) {
                // HOD online → send escalation message via socket
                io.to(hodSocketId).emit("receiveEscalation", newEnquiry);
                console.log(
                  `Escalation sent to online HOD of ${department.name}`
                );
              } else {
                // HOD offline → send email
                await sendNewEnquiryEmail(hod.email, {
                  message: userQuery,
                  department: department.name,
                });
                console.log(
                  `Escalation email sent to HOD of ${department.name}`
                );
              }
            } else {
              botReply = "No HOD found for this department.";
            }
          } else {
            botReply = "Department not found.";
          }
        } catch (err) {
          console.error("Error handling escalation:", err);
          botReply = "There was an error escalating your request.";
        }
      } else if (response === "no_info") {
        botReply =
          "I'm sorry, I can only answer questions related to Wezi Medical Centre. Please contact the clinic for other queries.";
      } else {
        botReply = response; // normal Q&A
      }
    }

    console.log(`Bot Reply: ${botReply}`);

    // Save bot reply
    const newResponse = await Chat.create({
      message: botReply,
      sender: "bot",
      userType,
      ...(userType === "registred" ? { user: id } : { userDeviceId: id }),
      metadata: { state },
    });

    res.status(200).json(newResponse);
  } catch (error) {
    console.log("API Error:", error);
    res
      .status(500)
      .json({ error: "Failed to get a response from the chatbot." });
  }
});

server.post("/api/chat/cancel-booking-session/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedBookingState = await BookingState.findOneAndDelete({ userId });
    const newResponse = await Chat.create({
      message: "Appointment booking session cancelled successfully",
      sender: "bot",
      userType: "registred",
      user: userId,
      metadata: { state: "chat" },
    });
    res.status(200).json(newResponse);
  } catch (error) {
    res.status(500).json({ status: "failed", error: error.message });
  }
});

server.get("/api/chats/hod/conversations/:hodId", async (req, res, next) => {
  try {
    const { hodId } = req.params;

    const conversations = await Chat.aggregate([
      {
        $match: {
          "metadata.escalatedTo": new mongoose.Types.ObjectId(hodId),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            userType: "$userType",
            user: "$user",
            deviceId: "$userDeviceId",
          },
          lastMessage: { $first: "$message" },
          lastMessageAt: { $first: "$createdAt" },
          escalatedDept: { $first: "$metadata.escalatedDept" },
          // unread check: only if sender is "user"
          unread: {
            $max: {
              $cond: [{ $eq: ["$sender", "user"] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.user",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $unwind: {
          path: "$patient",
          preserveNullAndEmptyArrays: true, // guest users won't have patient info
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    // Convert unread flag
    const formatted = conversations.map((conv) => ({
      userType: conv._id.userType,
      userId: conv._id.user,
      deviceId: conv._id.deviceId,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      escalatedDept: conv.escalatedDept,
      unread: conv.unread === 1,
      patient: conv.patient || null,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
});

// Get all messages for a specific patient/guest
server.get("/api/chats/:hodId/:patientId", auth, async (req, res, next) => {
  try {
    const { hodId, patientId } = req.params;

    // 1️⃣ Mark all unread patient messages as read
    await Chat.updateMany(
      {
        sender: "user",
        user: new mongoose.Types.ObjectId(patientId),
        "metadata.escalatedTo": new mongoose.Types.ObjectId(hodId),
      },
      { $set: { "metadata.seen": true } } // we can store seen under metadata
    );

    // 2️⃣ Fetch all messages between this HOD and the patient
    const messages = await Chat.find({
      $or: [
        {
          user: new mongoose.Types.ObjectId(patientId),
          "metadata.escalatedTo": new mongoose.Types.ObjectId(hodId),
        },
        {
          "metadata.escalatedTo": new mongoose.Types.ObjectId(hodId),
          sender: "hod",
        },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
});

const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

server.post(
  "/api/chat/audio",
  multer.single("audio"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;

      const formData = new FormData();
      formData.append("file", fileBuffer, {
        filename: originalName,
        contentType: mimeType,
      });
      formData.append("model", "whisper-1");

      const userPrompt = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
        }
      );

      console.log(userPrompt.data);

      const botReply = await getLangChainResponse(userPrompt.data.text);
      const savedPrompt = await Chat.create({
        message: userPrompt.data.text,
        sender: "user",
      });
      const newResponse = await Chat.create({
        message: botReply,
        sender: "bot",
      });

      res.json({
        response: newResponse,
        userPrompt: savedPrompt,
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

io.on("connection", (socket) => {
  const userId = socket?.handshake?.query?.userId;

  console.log(`User ${userId} is active`);

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  socket?.on(
    "sendEnquiry",
    async ({ message, senderId, receiverId, userType, userDeviceId }) => {
      try {
        if (!message) throw new Error("Message is required");

        const isHod = senderId && userType !== "guest";

        const newChat = await Chat.create({
          userType: userType || "registred",
          user: isHod ? receiverId : senderId, // patient id if HOD is sending
          userDeviceId: userType === "guest" ? receiverId : undefined,
          message,
          sender: isHod ? "hod" : "user",
          metadata: isHod ? { escalatedTo: senderId, from: "hod" } : {}, // HOD → patient
        });

        // Emit to patient
        const receiverSocketId =
          userType === "guest"
            ? userSocketMap[receiverId]
            : userSocketMap[receiverId];

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receiveChat", newChat);
        }
      } catch (err) {
        console.error("❌ Error sending HOD enquiry:", err);
      }
    }
  );

  socket.on("sendEmergency", async (emergencyPayload, callback) => {
    const { userType, sender, userDeviceId, locationLat, locationLang } =
      emergencyPayload;

    try {
      const { availableDriver, email } = await getAvailableDriver();

      let status = "onHold";
      let assignedTo = null;

      if (availableDriver) {
        status = "assigned";
        assignedTo = availableDriver;
      }

      // Create emergency
      let newEmergency = await Emergency.create({
        userType,
        ...(userType === "registred" ? { sender } : { userDeviceId }),
        locationLat,
        locationLang,
        status,
        assignedTo,
      });

      // ✅ Populate sender and assignedTo
      newEmergency = await newEmergency.populate([
        { path: "sender" },
        { path: "assignedTo" },
      ]);

      // Notify driver if connected
      if (availableDriver && userSocketMap[availableDriver]) {
        io.to(userSocketMap[availableDriver]).emit(
          "receiveEmergency",
          newEmergency
        );
      }

      // Send email
      if (email) {
        await sendEmergencyNotification(email, {
          locationLat,
          locationLang,
        });
      }

      console.log(newEmergency);

      // ✅ Send populated emergency back to client
      callback({ status: "success", emergency: newEmergency });
    } catch (err) {
      console.error("Error creating emergency:", err);
      callback({ status: "error", message: err.message });
    }
  });

  socket?.on("completeEmergency", async (id, callback) => {
    try {
      // Mark the current emergency as completed
      const emergency = await Emergency.findByIdAndUpdate(
        id,
        { status: "completed" },
        { new: true }
      );

      if (!emergency) {
        return callback({ status: "error", message: "Emergency not found" });
      }

      //update the patient's side
      if (userSocketMap[emergency.sender]) {
        io.to(userSocketMap[emergency.sender]).emit("completedEmergency");
      }

      //update the driver's side
      if (userSocketMap[emergency.assignedTo]) {
        io.to(userSocketMap[emergency.assignedTo]).emit("completedEmergency");
      }

      // Find the next emergency that is on hold
      const nextEmergency = await Emergency.findOne({ status: "onHold" });

      if (nextEmergency) {
        nextEmergency.status = "assigned";
        nextEmergency.assignedTo = emergency.assignedTo;
        await nextEmergency.save();

        // Fetch the email of the driver/staff assigned
        const userData = await Emergency.findById(nextEmergency._id)
          .populate("assignedTo", "email")
          .select("assignedTo");

        const email = userData?.assignedTo?.email;

        if (email) {
          await sendEmergencyNotification(email, "New Emergency Assigned", {
            userLocationLatitude: nextEmergency.userLocationLatitude,
            userLocationLongitude: nextEmergency.userLocationLongitude,
          });
        }
      }

      // Send back success via socket callback
      callback({
        status: "success",
        message: "Emergency completed successfully",
        data: emergency,
      });
    } catch (err) {
      console.error("Error completing emergency:", err);
      callback({ status: "error", message: err.message });
    }
  });

  socket.on("initiateChat", async (intiateChatPayload, callback) => {
    try {
      const prompt = `You are a helpful assistant for Wezi Medical Centre only.
        Focus on enquiries about services (Outpatient, Inpatient, Emergency, Antenatal, Theatre), navigation, and bookings.
        Do not discuss unrelated topics.`;
    } catch (error) {
      callback({ status: "error", message: err.message });
    }
  });

  socket.on("disconnect", () => {
    if (userId && userSocketMap[userId]) {
      delete userSocketMap[userId];
    }
  });
});

// Connect to MongoDB

const MONGO = process.env.MONGO_URI;
mongoose
  .connect(MONGO)
  .then(() => {
    console.log("✅ MongoDB connected");
    // Start Server
    const PORT = process.env.PORT;
    socketServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
