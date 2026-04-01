import { Hono } from "hono";
import { createOrder, verifyPayment, razorpayWebhook } from "../../../modules/payment/payment.controller";

const app = new Hono();

app.post("/payment/razorpay/create-order", createOrder);
app.post("/payment/razorpay/verify", verifyPayment);
app.post("/payment/razorpay/webhook", razorpayWebhook);

export default app;
