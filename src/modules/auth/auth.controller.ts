import type { Context } from 'hono';
import * as authService from './auth.service.ts';
import { checkOtpRateLimit } from '../../lib/rateLimiter';

export const signup = async (c: Context) => {
  const body = await c.req.json();
  const { email } = body;
  
  if (!checkOtpRateLimit(email || c.req.header('x-forwarded-for') || "unknown")) {
    return c.json({ success: false, message: "Too many OTP requests. Try again later." }, 429);
  }

  try {
    const res = await authService.signupService(body);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const verifyOtp = async (c: Context) => {
  const body = await c.req.json();
  try {
    const res = await authService.verifyOtpService(body);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const login = async (c: Context) => {
  const body = await c.req.json();
  const { email } = body;
  
  if (!checkOtpRateLimit(email || "unknown")) {
     return c.json({ success: false, message: "Too many login attempts." }, 429);
  }

  try {
    const res = await authService.loginService(body);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const refresh = async (c: Context) => {
  const body = await c.req.json();
  try {
    const res = await authService.refreshTokenService(body.refreshToken);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const forgotPassword = async (c: Context) => {
  const body = await c.req.json();
  const { email } = body;
  
  if (!checkOtpRateLimit(email || "unknown")) {
    return c.json({ success: false, message: "Too many OTP requests." }, 429);
  }

  try {
    const res = await authService.forgotPasswordService(email);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};

export const resetPassword = async (c: Context) => {
  const body = await c.req.json();
  try {
    const res = await authService.resetPasswordService(body);
    return c.json(res);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 400);
  }
};
