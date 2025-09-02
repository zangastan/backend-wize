const Appointment = require("../models/appointmentsModel")

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

        return appointments;
    } catch (error) {
        return { error: error.message }
    }
}

const getAllAppointments = async () => {
    try {
        const appointments = await Appointment.find()
            .populate('patientId')
            .populate('staffId')
            .populate('departmentId')

        if (!appointments) {
            throw new Error("No appointments found")
        }

        return appointments;
    } catch (error) {
        return { error: error.message }
    }
}
module.exports = {
    createAppointment,
    getAllAppointments,
    approveAppointment
}