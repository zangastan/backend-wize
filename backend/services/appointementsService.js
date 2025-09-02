const Appointment = require("../models/appointmentsModel")
const { sendMail } = require("../utils/sendMail")

const createAppointment = async (data) => {
    try {
        const newAppointment = new Appointment(data)
        await newAppointment.save()
        return newAppointment
    } catch (error) {
        return { error: error.message }
    }
}

const approveAppointment = async (id) => {
    try {
        const appointments = await Appointment.
            findOneAndUpdate(
                { _id: id },
                { status: 'approved' }, { new: true })
            .select()
            .populate("Users")
            .populate("Services")

        await sendMail({
            to: appointments.Users.email,
            subject: `Appointement update - ${appointments._id}`,
            html: `
<div style="font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f0fdf4;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #d1fae5;">
    
    <h1 style="font-size: 1.5rem; color: #065f46; margin-bottom: 16px;">
      Appointment Approved!
    </h1>
    
    <p style="font-size: 1rem; color: #065f46; margin-bottom: 24px;">
      Hello <strong>${appointments.users.name}</strong>, your appointment has been successfully approved. Please find the details below:
    </p>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Service:</p>
      <p style="margin: 4px 0 0;">${appointments.Services.name}</p>
    </div>

    <div style="background: #d1fae5; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
      <p style="margin: 0; font-weight: bold; color: #065f46;">Date & Time:</p>
      <p style="margin: 4px 0 0;">
        ${new Date(appointments.time).toLocaleDateString()} at ${new Date(appointments.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        `,
        });
        return appointments;
    } catch (error) {
        return { error: error.message }
    }
}

const getAllAppointments = async (id, role) => {
    let appointments;
    try {
        if (['admin', 'hod', 'doctor'].includes(role)) {
            appointments = await Appointment.find({ staffId: id })
                .populate('patientId')
                .populate('staffId')
                .populate('departmentId')
        } else {
            appointments = await Appointment.find({ patientId: id })
                .populate('patientId')
                .populate('staffId')
                .populate('departmentId')
        }
        
        if (!appointments) {
            throw new Error("No appointments found")
        }

        return appointments;
    } catch (error) {
        return { error: error.message }
    }
}

const appointement = async (id) => {
    try {
        const appointment = await Appointment.find({ _id: id })
            .populate("Users")
            .populate("Services")
            .populate("Department")
            .populate("Staff")

        if (appointment.error) {
            throw new Error("error fetching appointemt")
        }

        return appointment
    } catch (error) {
        console.log(error.message)
    }
}
module.exports = {
    createAppointment,
    getAllAppointments,
    approveAppointment,
    appointement
}