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

const sendEmail = async (to: string, subject: string, text: string, context: string) => {
  if (!SENDGRID_API_KEY) {
    console.warn(`[WARN] SENDGRID_API_KEY is not set. ${context} email not sent.`);
    return false;
  }

  try {
    await sgMail.send({ to, from: SENDGRID_FROM_EMAIL, subject, text });
    return true;
  } catch (err) {
    console.error(`[ERROR] Failed to send ${context} email:`, err);
    return false;
  }
};

export const buildReportUrl = (publicId: string) =>
  `${process.env.FRONTEND_URL || "https://anavyaailabs.com"}/scanner?id=${publicId}`;

export const sendReportReadyEmail = async (email: string, publicId: string, url: string) => {
  const reportUrl = buildReportUrl(publicId);
  const pdfLine = process.env.API_PUBLIC_URL
    ? `\nDownload the PDF: ${process.env.API_PUBLIC_URL}/api/v1/scan/${publicId}/pdf\n`
    : "";
  const text = `Great news! Your AI-generated deep audit report for ${url} is now ready to view.

Access your full report here: ${reportUrl}
${pdfLine}
Keep this link private: anyone with it can open your paid report.

Thank you for choosing Anavya AI Labs.`;

  return sendEmail(email, "Your AI Website Audit Report is Ready!", text, "report ready");
};

export const sendScoreDropEmail = async (
  email: string,
  url: string,
  previousScore: number,
  currentScore: number,
  publicId: string,
) => {
  const text = `Heads up: the website score for ${url} dropped from ${previousScore} to ${currentScore} in this week's automatic check.

See what changed: ${buildReportUrl(publicId)}

You are receiving this because ${url} is on your Anavya AI Labs Pro monitoring list.`;

  return sendEmail(email, `Score drop alert: ${url} fell to ${currentScore}`, text, "score drop");
};
