import * as authRepo from './auth.repository';
import { sendOTP } from '../../lib/sendOTP';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_anavya";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "super_secret_refresh_anavya";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const hashPassword = async (password: string) => {
  return await Bun.password.hash(password);
};

const verifyPassword = async (password: string, hash: string) => {
  return await Bun.password.verify(password, hash);
};

export const signupService = async (data: any) => {
  const { email, password, name, username, phoneNumber } = data;
  if (!email || !password) throw new Error("Email and password required");

  // check if exists
  const existing = await authRepo.getUserByEmail(email);
  if (existing) throw new Error("Email already registered");

  // logic: we won't create user fully active until verified.
  // Actually, we can create user and leave emailVerifiedAt as null.
  const hashedPassword = await hashPassword(password);
  await authRepo.createUserRepo({
    email,
    password: hashedPassword,
    name,
    username,
    phoneNumber,
    authProvider: "local",
  });

  const otpCode = generateOTP();
  // Expires in 10 mins
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await authRepo.createOtpRepo({ email, otp: otpCode, type: "signup", expiresAt });
  await sendOTP(email, otpCode, "signup");

  return { success: true, message: "OTP sent successfully. Please verify your email." };
};

export const verifyOtpService = async (data: any) => {
  const { email, otp } = data;
  if (!email || !otp) throw new Error("Email and OTP required");

  const validOtp = await authRepo.getValidOtp(email, otp, "signup");
  if (!validOtp) throw new Error("Invalid or expired OTP");

  const user = await authRepo.getUserByEmail(email);
  if (!user) throw new Error("User not found");

  await authRepo.updateUserRepo(user.id, { emailVerifiedAt: new Date() });
  await authRepo.deleteOtp(validOtp.id);

  return { success: true, message: "Email verified successfully. You can now login." };
};

export const loginService = async (data: any) => {
  const { email, password } = data;
  if (!email || !password) throw new Error("Email and password required");

  const user = await authRepo.getUserByEmail(email);
  if (!user || !user.password) throw new Error("Invalid credentials");

  if (!user.emailVerifiedAt) throw new Error("Please verify your email first");

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) throw new Error("Invalid credentials");

  // Tokens
  const accessToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  
  // Refresh token
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await authRepo.createRefreshToken({
    token: refreshTokenString,
    userId: user.id,
    expiresAt,
  });

  return {
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken: refreshTokenString,
  };
};

export const refreshTokenService = async (token: string) => {
  if (!token) throw new Error("Refresh token required");

  const rt = await authRepo.getRefreshToken(token);
  if (!rt || rt.revoked) throw new Error("Invalid refresh token");

  if (new Date() > new Date(rt.expiresAt)) {
    throw new Error("Refresh token expired");
  }

  const user = await authRepo.getUserById(rt.userId);
  if (!user) throw new Error("User associated with token not found");

  const accessToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  
  // Roll refresh token for extra security
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await authRepo.deleteRefreshToken(token);
  await authRepo.createRefreshToken({
    token: newRefreshToken,
    userId: user.id,
    expiresAt,
  });

  return { success: true, accessToken, refreshToken: newRefreshToken };
};

export const forgotPasswordService = async (email: string) => {
  if (!email) throw new Error("Email required");

  // Even if user doesn't exist, we return success to prevent email enumeration
  const user = await authRepo.getUserByEmail(email);
  if (!user) return { success: true, message: "If that email exists, a reset link was sent." };

  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await authRepo.createOtpRepo({ email, otp: otpCode, type: "reset_password", expiresAt });
  await sendOTP(email, otpCode, "reset");

  return { success: true, message: "Password reset OTP sent to your email." };
};

export const resetPasswordService = async (data: any) => {
  const { email, otp, newPassword } = data;
  if (!email || !otp || !newPassword) throw new Error("Email, OTP, and newPassword required");

  const validOtp = await authRepo.getValidOtp(email, otp, "reset_password");
  if (!validOtp) throw new Error("Invalid or expired OTP");

  const user = await authRepo.getUserByEmail(email);
  if (!user) throw new Error("User not found");

  const hashedPassword = await hashPassword(newPassword);
  
  await authRepo.updateUserRepo(user.id, { password: hashedPassword });
  await authRepo.deleteOtp(validOtp.id);

  return { success: true, message: "Password reset successfully. You can now login." };
};
