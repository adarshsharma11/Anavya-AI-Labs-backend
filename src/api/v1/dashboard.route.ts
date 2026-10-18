import { Hono } from 'hono';
import { getProfile, updateProfile, getScans, getAnalytics } from '../../modules/dashboard/dashboard.controller.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';

const dashboardRoute = new Hono();

dashboardRoute.use('*', verifyToken);

dashboardRoute.get('/me', getProfile);
dashboardRoute.put('/me', updateProfile);
dashboardRoute.get('/scans', getScans);
dashboardRoute.get('/analytics', getAnalytics);

export default dashboardRoute;
