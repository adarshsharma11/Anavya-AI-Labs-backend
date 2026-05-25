import { Hono } from "hono";
import {
  createOrder,
  getQuote,
  verifyPayment,
  razorpayWebhook,
} from "../../../modules/payment/payment.controller";

const app = new Hono();

app.get("/payment/razorpay/quote", getQuote);
app.post("/payment/razorpay/create-order", createOrder);
app.post("/payment/razorpay/verify", verifyPayment);
app.post("/payment/razorpay/webhook", razorpayWebhook);

export default app;
