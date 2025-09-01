// send mail
import nodemailer from "nodemailer";
import dotenv from "dotenv"

dotenv.config();

export async function sendMail({ to, subject, text, html, attachments = [] }) {
  try {
    console.log("📧 Sending email to:", to);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      text,
      ...(html && { html }),
      attachments,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully");
  } catch (err) {
    console.error("❌ sendMail error:", err);
    throw err;
  }
}