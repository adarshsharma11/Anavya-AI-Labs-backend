import type { Context } from "hono";
import crypto from "crypto";
import { razorpay } from "../../lib/razorPay";
import { getScanRepo, updateScanRepo } from "../scan/scan.repository";
import { generateFullReport } from "../../lib/aiReport";

export const createOrder = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { amount, currency = "INR", scanId } = body;

    if (!amount || !scanId)
      return c.json({ success: false, message: "Missing fields" }, 400);

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to cents
      currency,
      receipt: `scan_${scanId}_${Date.now()}`,
      notes: { scanId },
    });
    console.log(order, 'order');

    return c.json({ success: true, order });
  } catch (e: any) {
    return c.json({ e }, 500);
  }
};

export const verifyPayment = async (c: Context) => {
  try {
    const body = await c.req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      scanId,
    } = body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return c.json({ success: false, message: "Invalid signature" }, 400);
    }

    return c.json({ success: true, message: "Payment verified" });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
};

export const razorpayWebhook = async (c: any) => {
  const ok = () => c.json({ success: true }, 200);
  try {
    const body = await c.req.text(); // important: raw body
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
      console.error("Webhook error: missing signature");
      return ok();
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Webhook error: invalid signature");
      return ok();
    }

    const event = JSON.parse(body);

    // Handle successful payment
    if (event.event === "payment.captured") {
      const scanId = event.payload.payment.entity.notes.scanId;

      if (scanId) {
        const scan = await getScanRepo(Number(scanId));

        if (!scan) {
          console.error("Webhook error: scan not found", scanId);
          return ok();
        }

        if (scan.isUnlocked) {
          console.log("✅ Scan already unlocked, skipping:", scanId);
          return ok();
        }

        if (scan.preview) {
          try {
            const fullReport = await generateFullReport(scan.url, scan.preview);
            await updateScanRepo(Number(scanId), {
              isUnlocked: true,
              fullReport,
              status: "completed",
            });
            console.log("✅ Full report generated and saved:", scanId);
          } catch (err: any) {
            console.error("Webhook error: report generation failed", err?.message);
          }
        } else {
          console.error("Webhook error: preview missing, cannot generate", scanId);
        }
      }
    }

    return ok();
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return c.json({ success: false }, 200);
  }
};
