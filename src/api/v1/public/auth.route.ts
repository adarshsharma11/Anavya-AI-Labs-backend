import { Hono } from 'hono';
import { signup, login, refresh, forgotPassword, resetPassword } from '../../../modules/auth/auth.controller';

const authRoute = new Hono();

authRoute.post('/signup', signup);

authRoute.post('/login', login);
authRoute.post('/refresh', refresh);
authRoute.post('/forgot-password', forgotPassword);
authRoute.post('/reset-password', resetPassword);

// Scaffold Google OAuth
authRoute.get('/google', (c) => {
  return c.json({ success: true, message: "Google OAuth redirect placeholder. Refer to documentation to configure Passport/Hono OAuth." });
});

export default authRoute;
