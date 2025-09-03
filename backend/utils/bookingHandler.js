const dayjs = require("dayjs");
const Appointment = require("../models/appointmentsModel");
const BookingState = require("../models/BookingState");
const serviceServices = require("../services/serviceService");
const AppointmentServices = require("../services/appointementsService");

async function handleBookingFlow(input, bookingState, userId) {
  console.log(input);
  // Step 1: Waiting for Service
  if (bookingState.step === "waiting_for_service") {
    const services = await serviceServices.getAllSerevices();

    // Allow input as string (e.g., "X-Ray Imaging") or object
    let inputServiceName = "";
    let inputServiceId = "";

    if (typeof input === "string") {
      inputServiceName = input.trim().toLowerCase();
    } else if (typeof input === "object") {
      inputServiceName = input.serviceName?.trim().toLowerCase();
      inputServiceId = input.serviceId;
    }

    // Find the service by name or ID
    const service = services.find(
      (s) =>
        s._id.toString() === inputServiceId ||
        s.name.toLowerCase() === inputServiceName
    );

    console.log("Selected service: ", service);

    if (!service) {
      return `Please choose a valid service from the list: ${services
        .map((s) => s.name)
        .join(", ")}`;
    }

    bookingState.serviceId = service._id;
    bookingState.departmentId = service.departmentId;
    bookingState.step = "waiting_for_date";
    await bookingState.save();

    return "Great! Please provide the appointment date in YYYY-MM-DD format.";
  }

  // Step 2: Waiting for Date
  if (bookingState.step === "waiting_for_date") {
    const date = dayjs(input, "YYYY-MM-DD");
    if (!date.isValid())
      return "Invalid date. Please enter in YYYY-MM-DD format.";
    bookingState.date = input;
    bookingState.step = "waiting_for_time";
    await bookingState.save();
    return "Got it! Now, please provide a preferred time (e.g., 10:30 AM).";
  }

  // Step 3: Waiting for Time
  if (bookingState.step === "waiting_for_time") {
    const time = input;
    const dateTime = dayjs(`${bookingState.date} ${time}`, [
      "YYYY-MM-DD hh:mm A",
      "YYYY-MM-DD HH:mm",
    ]);

    if (!dateTime.isValid()) {
      return "Invalid time format. Please provide a valid time like 10:30 AM or 14:30.";
    }

    console.log("Boking stage: ", bookingState);

    const newAppointment = await AppointmentServices.createAppointment({
      patientId: bookingState?.userId,
      serviceId: bookingState?.serviceId,
      date: bookingState?.date,
      time: dateTime,
      status: "scheduled",
      departmentId: bookingState?.departmentId,
      notes: "",
    });
    await BookingState.findByIdAndDelete(bookingState?._id);
    if (newAppointment.error) {
      console.log(newAppointment.error)
      return "No doctors available for this service";
    }

    return `Your appointment for service has been booked on ${bookingState.date} at ${time}.`;
  }
}

module.exports = handleBookingFlow;
