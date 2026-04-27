const map = new Map<string, { count: number; time: number }>();
const otpMap = new Map<string, { count: number; time: number }>();
const aiMap = new Map<string, { count: number; time: number }>();

export const checkRateLimit = (ip: string) => {
  const now = Date.now();
  const rec = map.get(ip);
  if (!rec) { map.set(ip, { count: 1, time: now }); return true; }
  if (now - rec.time > 60000) { map.set(ip, { count: 1, time: now }); return true; }
  if (rec.count >= 10) return false;
  rec.count++;
  return true;
};

export const checkOtpRateLimit = (ipOrEmail: string) => {
  const now = Date.now();
  const rec = otpMap.get(ipOrEmail);
  if (!rec) { otpMap.set(ipOrEmail, { count: 1, time: now }); return true; }
  // 5 requests per 10 mins
  if (now - rec.time > 10 * 60 * 1000) { otpMap.set(ipOrEmail, { count: 1, time: now }); return true; }
  if (rec.count >= 5) return false;
  rec.count++;
  return true;
};

export const checkAiRateLimit = (ipOrUserId: string) => {
  const now = Date.now();
  const rec = aiMap.get(ipOrUserId);
  if (!rec) { aiMap.set(ipOrUserId, { count: 1, time: now }); return true; }
  // 10 requests per hour
  if (now - rec.time > 60 * 60 * 1000) { aiMap.set(ipOrUserId, { count: 1, time: now }); return true; }
  if (rec.count >= 10) return false;
  rec.count++;
  return true;
};
