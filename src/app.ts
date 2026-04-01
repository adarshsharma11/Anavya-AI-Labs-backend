import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pricingRoute from './api/v1/public/pricing.route'
import scanRoute from './api/v1/public/scan.route'
import servicesRoute from './api/v1/public/services.route'
import paymentRoute from './api/v1/public/payment.route'



const app = new Hono()

const apiPrefix = '/api/v1'

// CORS middleware
app.use(
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
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

// pricing routes
app.route(apiPrefix, pricingRoute)
app.route(apiPrefix, scanRoute)
app.route(apiPrefix, servicesRoute)
app.route(apiPrefix, paymentRoute)



export default app
