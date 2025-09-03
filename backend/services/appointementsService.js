const Appointment = require("../models/appointmentsModel");
const Users = require("../models/userModel");
const service = require("../models/servicesModel");
const { sendMail } = require("../utils/sendMail");

const createAppointment = async (data) => {
  try {
    const serviceId = data.serviceId;
    const services = await service.findById(serviceId);
    if (!services) {
      throw new Error("Service not found");
    }

    const doctors = await Users.find({
      role: "doctor",
      departmentId: services.departmentId,
    }).populate("linkedStaffId");
    console.log("Available Doctors:", doctors);

    if (doctors.length === 0) {
      // return {error : "No doctors available in this department"}
      throw new Error("No doctors available in this department");
    }
    const randomDoctor = doctors[Math.floor(Math.random() * doctors.length)];
    data.staffId = randomDoctor._id;

    console.log("Assigned Doctor ID:", randomDoctor._id);
    console.log("Assigned Doctor Name:", randomDoctor.name);
    console.log("Assigned Doctor Email:", randomDoctor.email);
    console.log(
      "Assigned Doctor Specialty:",
      randomDoctor.linkedStaffId?.specialties
    );

    const newAppointment = new Appointment({
      ...data,
      departmentId: services.departmentId,
    });
    await newAppointment.save();
    return newAppointment;
  } catch (error) {
    return { error: error.message };
  }
};

const approveAppointment = async (id) => {
  try {
    console.log("approveAppointment id:", id);
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true }
    )
      .populate("patientId") // ✅ adjust to your schema field
      .populate("serviceId")
      .populate("staffId");
    console.log("Updated appointment:", appointment);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // ✅ Build email HTML
    const emailHtml = `
<div style="font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f0fdf4;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #d1fae5;">
    
    <h1 style="font-size: 1.5rem; color: #065f46; margin-bottom: 16px;">
      Appointment Approved!
    </h1>
    
    <p style="font-size: 1rem; color: #065f46; margin-bottom: 24px;">
      Hello <strong>${
        appointment.patientId?.username || "Patient"
      }</strong>, your appointment has been successfully approved. Please find the details below:
    </p>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Service:</p>
      <p style="margin: 4px 0 0;">${appointment.serviceId?.name || "N/A"}</p>
    </div>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Date & Time:</p>
      <p style="margin: 4px 0 0;">
        ${new Date(appointment.time).toLocaleDateString()} at 
        ${new Date(appointment.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>

    <p style="font-size: 0.95rem; color: #065f46;">
      Thank you for using WEZI Clinic. We look forward to seeing you at your appointment!
    </p>

    <hr style="margin: 24px 0; border-color: #d1fae5;" />

    <p style="font-size: 0.85rem; color: #065f46;">
      If you have any questions, please contact us at 
      <a href="mailto:weziclinic@support.com" style="color: #10b981; text-decoration: none;">weziclinic@support.com</a>.
    </p>

    <p style="margin-top: 24px; font-size: 0.85rem; color: #065f46;">– WEZI Clinic Team</p>
  </div>
</div>
        `;
    // ✅ Send mail
    await sendMail({
      to: appointment.patientId?.email,
      subject: `Appointment Update - ${appointment._id}`,
      html: emailHtml,
    });

    return appointment;
  } catch (error) {
    console.error("approveAppointment error:", error);
    return { error: error.message };
  }
};

const moveDate = async (id, data) => {
  try {
    const postpone = await Appointment.findByIdAndUpdate(
      id,
      { time: data.time },
      { new: true }
    )
      .select()
      .populate("patientId") // ✅ adjust to your schema field
      .populate("serviceId")
      .populate("staffId");
    if (!postpone) {
      throw new Error("Appointment not found");
    }
    const emailHtml = `
<div style="font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f0fdf4;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #d1fae5;">
    
    <h1 style="font-size: 1.5rem; color: #065f46; margin-bottom: 16px;">
      Appointment Reschedulesd
    </h1>
    
    <p style="font-size: 1rem; color: #065f46; margin-bottom: 24px;">
      Hello <strong>${
        postpone.patientId?.username || "Patient"
      }</strong>, We would like to inform you that your appointment has been rescheduled. Please find the updated details below:
    </p>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Service:</p>
      <p style="margin: 4px 0 0;">${postpone.serviceId?.name || "N/A"}</p>
    </div>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Date & Time:</p>
      <p style="margin: 4px 0 0;">
        ${new Date(postpone.time).toLocaleDateString()} at 
        ${new Date(postpone.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>

    <p style="font-size: 0.95rem; color: #065f46;">
      Thank you for understanding. We look forward to seeing you at your appointment!
    </p>

    <hr style="margin: 24px 0; border-color: #d1fae5;" />

    <p style="font-size: 0.85rem; color: #065f46;">
      If you have any questions, please contact us at 
      <a href="mailto:weziclinic@support.com" style="color: #10b981; text-decoration: none;">weziclinic@support.com</a>.
    </p>

    <p style="margin-top: 24px; font-size: 0.85rem; color: #065f46;">– WEZI Clinic Team</p>
  </div>
</div>
        `;

    await sendMail({
      to: postpone.patientId?.email,
      subject: `Appointment Update - ${postpone._id}`,
      html: emailHtml,
    });
    return postpone;
  } catch (error) {
    console.error("approveAppointment error:", error);
    return { error: error.message };
  }
};
// ✅ Service function
const getAllAppointments = async (id, role) => {
  try {
    let appointments;
    if (role === "doctor") {
      appointments = await Appointment.find({ staffId: id })
        .populate("patientId")
        .populate("serviceId")
        .populate("staffId")
        .populate("departmentId");
    } else {
      appointments = await Appointment.find({ patientId: id })
        .populate("patientId")
        .populate("serviceId")
        .populate("staffId")
        .populate("departmentId");
    }
    if (!appointments || appointments.length === 0) {
      throw new Error("No appointments found");
    }

    return appointments;
  } catch (error) {
    return { error: error.message };
  }
};

const appointement = async (id) => {
  try {
    const appointment = await Appointment.find({ _id: id })
      .populate("Users")
      .populate("Services")
      .populate("Department")
      .populate("Staff");

    if (appointment.error) {
      throw new Error("error fetching appointemt");
    }

    return appointment;
  } catch (error) {
    console.log(error.message);
  }
};
module.exports = {
  createAppointment,
  getAllAppointments,
  approveAppointment,
  appointement,
  moveDate,
};
