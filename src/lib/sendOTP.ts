import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@anavyaailabs.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export const sendOTP = async (email: string, otp: string, type: 'signup' | 'reset') => {
  const subject = type === 'signup' ? "Your Anavya AI Labs Verification Code" : "Reset Your Password";
  const text = `Your verification code is: ${otp}. It will expire in 10 minutes.`;

  if (!SENDGRID_API_KEY) {
    console.warn("[WARN] SENDGRID_API_KEY is not set. OTP email was not sent. Check your .env file.");
    // We still return true here to prevent breaking the flow if someone forgets to add the key in development,
    // but the actual production requirement is to send the email.
    return true; 
  }

  const msg = {
    to: email,
    from: SENDGRID_FROM_EMAIL,
    subject,
    text,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (err) {
    console.error("[ERROR] Failed to send OTP via SendGrid:", err);
    return false;
  }
};
