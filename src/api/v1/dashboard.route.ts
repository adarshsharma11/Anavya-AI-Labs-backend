import { Hono } from 'hono';
import { getProfile, updateProfile, getScans, getAnalytics } from '../../modules/dashboard/dashboard.controller';
import { verifyToken } from '../../middlewares/auth.middleware';

const dashboardRoute = new Hono();

dashboardRoute.use('*', verifyToken);

dashboardRoute.get('/me', getProfile);
dashboardRoute.put('/me', updateProfile);
dashboardRoute.get('/scans', getScans);
dashboardRoute.get('/analytics', getAnalytics);

export default dashboardRoute;
