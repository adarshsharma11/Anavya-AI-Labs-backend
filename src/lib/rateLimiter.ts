const map = new Map<string, { count: number; time: number }>();

export const checkRateLimit = (ip: string) => {
  const now = Date.now();
  const rec = map.get(ip);

  if (!rec) {
    map.set(ip, { count: 1, time: now });
    return true;
  }

  // reset after 1 min
  if (now - rec.time > 60000) {
    map.set(ip, { count: 1, time: now });
    return true;
  }

  if (rec.count >= 5) return false;

  rec.count++;
  return true;
};
