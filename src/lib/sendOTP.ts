import nodemailer from "nodemailer";

// In a real env, import these from process.env
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export const sendOTP = async (email: string, otp: string, type: 'signup' | 'reset') => {
  const isDev = process.env.NODE_ENV === "development" || !SMTP_USER;

  if (isDev) {
    console.log(`\n========================================`);
    console.log(`[MOCK EMAIL] To: ${email}`);
    console.log(`[MOCK EMAIL] OTP (${type}): ${otp}`);
    console.log(`========================================\n`);
    return true; // Mock success
  }

  const subject = type === 'signup' ? "Your Anavya AI Labs Verification Code" : "Reset Your Password";
  const text = `Your verification code is: ${otp}. It will expire in 10 minutes.`;

  try {
    await transporter.sendMail({
      from: `"Anavya AI Labs" <${SMTP_USER}>`,
      to: email,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error("Failed to send plain email OTP:", err);
    return false;
  }
};
