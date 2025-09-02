const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: process.env.GMAIL_USER_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

exports.sendNewEnquiryEmail = async (to, subject) => {
  try {
    await transporter.sendMail({
      from: `"Wezi Medical Centre" <${process.env.GMAIL_USER_EMAIL}>`,
      to,
      subject,
      replyTo: process.env.GMAIL_USER_EMAIL,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high",
      },
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #052e16; line-height: 1.5; background:#f9fafb; padding:20px;">
            <div style="max-width:600px;margin:auto;background:white;padding:20px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1)">
              <h2 style="color:#2563eb; margin-bottom:15px;">Wezi Medical Centre</h2>
              <p>Hello,</p>
              <p>You have a <strong>new enquiry</strong> waiting for you. Please log in to your account to review it.</p>
              <p style="margin-top:20px;">Warm Regards,<br>Wezi Medical Centre Team</p>
              <hr style="margin-top:20px;">
              <p style="font-size:12px;color:#6b7280;">This is an automated message. If you did not expect this, please ignore it.</p>
            </div>
          </body>
        </html>
      `,
      text: `Hello, You have a new enquiry waiting for you. Please check your dashboard. Warm Regards, Wezi Medical Centre Team`,
    });

    console.log("Enquiry alert Email sent successfully to", to);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

exports.welcomeEmail = async (to, subject, name, password, role) => {
  try {
    await transporter.sendMail({
      to: to,
      subject: subject,
      html: `
  <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
    <p>Dear ${name},</p>

    <p>We are pleased to inform you that you have been successfully added to the <strong>Wezi Medical Centre</strong> system with the role of <strong>${role}</strong>.</p>

    <p>Your temporary password is:</p>
    <p style="font-weight: bold; background-color: #f2f2f2; padding: 10px; width: fit-content; border-radius: 5px;">${password}</p>

    <p>For your security, please log in as soon as possible and update your password.</p>

    <p>If you have any questions or need assistance, kindly contact our support team at <a href="mailto:wezimedicalcentre.team@gmail.com">wezimedicalcentre.team@gmail.com</a>.</p>

    <p>Best regards,<br/>Wezi Medical Centre Team</p>
  </div>
`,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.sendEmergencyNotification = async (to, emergencyDetails) => {
  console.log("emergencyDetails: ", emergencyDetails);
  try {
    await transporter.sendMail({
      to,
      subject: `Emergency Alert`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background-color: #1e40af; padding: 25px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 26px;">🚨 Emergency Notification</h1>
            <p style="margin: 5px 0 0; font-size: 16px;">Wezi Medical Centre</p>
          </div>

          <!-- Body -->
          <div style="padding: 25px; color: #1f2937; font-size: 16px; line-height: 1.6;">
            <p>Dear Responder,</p>

            <p>You have been assigned a new emergency. Please review the patient location below and respond promptly.</p>

            <!-- Details Table -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 10px; font-weight: bold; width: 40%;">Patient Location:</td>
                <td style="padding: 10px;">
                  <a href="https://www.google.com/maps/search/?api=1&query=${emergencyDetails.locationLat},${emergencyDetails.locationLang}" target="_blank" style="color: #2563eb; text-decoration: none;">
                    View on Google Maps
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin-top: 25px;">Your swift action can save lives. Please respond as soon as possible.</p>

            <p>Best regards,<br/><strong>Wezi Medical Centre Team</strong></p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            This is an automated message. Please do not reply.
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.log("Error sending emergency email:", error);
  }
};
