import { Hono } from 'hono';
import { getProfile, updateProfile, getScans, getAnalytics } from '../../modules/dashboard/dashboard.controller.js';
import {
  addMonitor,
  deleteMonitor,
  getMonitorHistory,
  listMonitors,
} from '../../modules/monitor/monitor.controller.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';

const dashboardRoute = new Hono();

dashboardRoute.use('*', verifyToken);

dashboardRoute.get('/me', getProfile);
dashboardRoute.put('/me', updateProfile);
dashboardRoute.get('/scans', getScans);
dashboardRoute.get('/analytics', getAnalytics);

dashboardRoute.get('/monitors', listMonitors);
dashboardRoute.post('/monitors', addMonitor);
dashboardRoute.delete('/monitors/:id', deleteMonitor);
dashboardRoute.get('/monitors/:id/history', getMonitorHistory);

export default dashboardRoute;
