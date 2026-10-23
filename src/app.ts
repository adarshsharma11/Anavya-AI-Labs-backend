import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pricingRoute from './api/v1/public/pricing.route.js'
import scanRoute from './api/v1/public/scan.route.js'
import servicesRoute from './api/v1/public/services.route.js'
import blogsRoute from './api/v1/public/blogs.route.js'
import paymentRoute from './api/v1/public/payment.route.js'
import pageRoute from './api/v1/public/page.route.js'
import authRoute from './api/v1/public/auth.route.js'
import dashboardRoute from './api/v1/dashboard.route.js'
import settingsRoute from './api/v1/public/settings.route.js'
import contactRoute from './api/v1/public/contact.route.js'
import portfolioRoute from './api/v1/public/portfolio.route.js'
import aboutRoute from './api/v1/public/about.route.js'
import adminRoute from './api/v1/admin.route.js'
import geoRoute from './api/v1/public/geo.route.js'
import cronRoute from './api/cron.route.js'


import { env } from './config/env.js'

const app = new Hono()

const apiPrefix = '/api/v1'

// CORS middleware
app.use(
  cors({
    origin: (origin) => {
      if (env.NODE_ENV !== 'production') return '*';
      if (!origin) return env.FRONTEND_URL;
      if (origin === env.FRONTEND_URL || origin.startsWith('http://localhost:')) {
        return origin;
      }
      return env.FRONTEND_URL;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-client-region'],
  })
)

// health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Backend running 🚀'
  })
})

// test api
app.get('/api/test', (c) => {
  return c.json({
    success: true,
    msg: 'API working'
  })
})

// routes
app.route(apiPrefix, geoRoute)
app.route('/api', geoRoute)
app.route(apiPrefix, pricingRoute)
app.route(apiPrefix, scanRoute)
app.route(apiPrefix, servicesRoute)
app.route(apiPrefix, blogsRoute)
app.route(apiPrefix, paymentRoute)
app.route(apiPrefix, pageRoute)
app.route(`${apiPrefix}/auth`, authRoute)
app.route(`${apiPrefix}/dashboard`, dashboardRoute)
app.route(apiPrefix, settingsRoute)
app.route(apiPrefix, contactRoute)
app.route(apiPrefix, portfolioRoute)
app.route(apiPrefix, aboutRoute)
app.route(apiPrefix, adminRoute)
app.route('/api/cron', cronRoute)


export default app
