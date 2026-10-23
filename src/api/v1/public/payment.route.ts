import { Hono } from "hono";
import {
  createOrder,
  getQuote,
  verifyPayment,
  razorpayWebhook,
} from "../../../modules/payment/payment.controller.js";
import {
  cancelSubscription,
  createSubscription,
  getSubscription,
  verifySubscription,
} from "../../../modules/subscription/subscription.controller.js";
import { optionalVerifyToken, verifyToken } from "../../../middlewares/auth.middleware.js";

const app = new Hono();

app.get("/payment/razorpay/quote", getQuote);
app.post("/payment/razorpay/create-order", optionalVerifyToken, createOrder);
app.post("/payment/razorpay/verify", verifyPayment);
app.post("/payment/razorpay/webhook", razorpayWebhook);

app.post("/payment/razorpay/subscribe", verifyToken, createSubscription);
app.post("/payment/razorpay/subscribe/verify", verifyToken, verifySubscription);
app.get("/payment/subscription", verifyToken, getSubscription);
app.post("/payment/subscription/cancel", verifyToken, cancelSubscription);

export default app;
