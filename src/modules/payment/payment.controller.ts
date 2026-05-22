import type { Context } from "hono";
import crypto from "crypto";
import { razorpay } from "../../lib/razorPay";
import { getScanRepo, updateScanRepo } from "../scan/scan.repository";
import { generateFullReport } from "../../lib/aiReport";
import { sendReportReadyEmail } from "../../lib/sendOTP";
import { getUserById } from "../auth/auth.repository";

import { logError } from "../../lib/errorLog";
import { env } from "../../config/env";

/** Razorpay order currency — must be INR (amount is in paise). */
const RAZORPAY_CURRENCY = "INR" as const;

function amountToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

const WEBHOOK_SECRET_PLACEHOLDERS = new Set([
  "",
  "your_webhook_secret",
  "your_razorpay_webhook_secret",
]);

function secureCompare(expected: string, actual: string): boolean {
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(actual, "utf8"),
  );
}

const unlockScan = async (scanId: number) => {
  const scan = await getScanRepo(scanId);
  if (!scan) {
    return { ok: false as const, reason: "Scan not found" };
  }

  if (!scan.isUnlocked) {
    await updateScanRepo(scanId, {
      isUnlocked: true,
      status: scan.status === "completed" ? scan.status : "paid",
    });
  }

  return { ok: true as const };
};

const unlockAndGenerateReport = async (scanId: number) => {
  const scan = await getScanRepo(scanId);
  if (!scan) {
    logError("UNLOCK_REPORT", new Error("Scan not found"), { scanId });
    return { ok: false as const, reason: "Scan not found" };
  }

  await unlockScan(scanId);

  // If already has report or no preview to work with
  if (!scan.preview || scan.fullReport) {
    return { ok: true as const };
  }

  await updateScanRepo(scanId, { status: "generating_full_report" });

  try {
    const fullReport = await generateFullReport(scan.url, scan.preview, {
      url: scan.competitorUrl,
      preview: scan.competitorPreview,
      analysis: scan.competitorAnalysis,
    });

    await updateScanRepo(scanId, { fullReport, status: "completed" });

    // Send email notification
    let targetEmail = scan.userEmail;
    if (!targetEmail && scan.userId) {
      const user = await getUserById(scan.userId);
      if (user) targetEmail = user.email;
    }

    if (targetEmail) {
      await sendReportReadyEmail(targetEmail, scan.id, scan.url);
    }

    return { ok: true as const };
  } catch (err: any) {
    logError("AI_REPORT_GENERATION", err, { scanId, url: scan.url });

    // Even if it fails, mark as completed so the UI stops polling/loading
    // The generateFullReport with retry already returns a fallback, 
    // but this catch handles extreme cases (e.g. DB update failure of the fallback)
    await updateScanRepo(scanId, { status: "completed" });
    return { ok: false as const, reason: err?.message || "Report generation failed" };
  }
};

export const createOrder = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { amount, scanId, currency: requestedCurrency } = body;

    if (!amount || !scanId)
      return c.json({ success: false, message: "Missing fields" }, 400);

    if (
      requestedCurrency &&
      String(requestedCurrency).trim().toUpperCase() !== RAZORPAY_CURRENCY
    ) {
      return c.json(
        { success: false, message: "Only INR payments are supported" },
        400,
      );
    }

    const numericAmount = Number(amount);
    const expectedAmount = env.PAYMENT_UNLOCK_AMOUNT;
    if (
      !Number.isFinite(numericAmount) ||
      Math.abs(numericAmount - expectedAmount) > 0.001
    ) {
      return c.json({ success: false, message: "Invalid payment amount" }, 400);
    }

    const amountPaise = amountToPaise(numericAmount);

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: RAZORPAY_CURRENCY,
      receipt: `scan_${scanId}_${Date.now()}`,
      notes: { scanId: String(scanId) },
    });

    if (String(order.currency).toUpperCase() !== RAZORPAY_CURRENCY) {
      logError("CREATE_ORDER_CURRENCY", new Error("Razorpay order currency mismatch"), {
        scanId,
        currency: order.currency,
      });
      return c.json(
        { success: false, message: "Order was not created in INR" },
        500,
      );
    }

    return c.json({
      success: true,
      order,
      currency: RAZORPAY_CURRENCY,
      amount_paise: amountPaise,
      key_id: env.RAZORPAY_KEY_ID,
    });
  } catch (e: any) {
    logError("CREATE_ORDER_FAILED", e);
    const errorMsg = e.error?.description || e.message || "Order creation failed";
    return c.json({
      success: false,
      message: errorMsg,
      error: e
    }, 500);
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

    if (!env.RAZORPAY_KEY_SECRET) {
      return c.json(
        { success: false, message: "RAZORPAY_KEY_SECRET is not set" },
        500,
      );
    }

    const generatedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (!secureCompare(generatedSignature, razorpay_signature)) {
      return c.json({ success: false, message: "Invalid signature" }, 400);
    }

    if (!scanId) {
      return c.json({ success: false, message: "scanId is required" }, 400);
    }

    const order = await razorpay.orders.fetch(razorpay_order_id);
    if (String(order.currency).toUpperCase() !== RAZORPAY_CURRENCY) {
      return c.json({ success: false, message: "Invalid order currency" }, 400);
    }

    const expectedPaise = amountToPaise(env.PAYMENT_UNLOCK_AMOUNT);
    if (Number(order.amount) !== expectedPaise) {
      return c.json({ success: false, message: "Invalid order amount" }, 400);
    }

    const orderScanId = order.notes?.scanId;
    if (!orderScanId || String(orderScanId) !== String(scanId)) {
      return c.json(
        { success: false, message: "Payment does not match this scan" },
        400,
      );
    }

    const numericScanId = Number(scanId);
    if (!Number.isFinite(numericScanId) || numericScanId <= 0) {
      return c.json({ success: false, message: "Invalid scanId" }, 400);
    }

    const unlockResult = await unlockScan(numericScanId);
    void unlockAndGenerateReport(numericScanId);
    return c.json({
      success: true,
      message: "Payment verified",
      unlocked: unlockResult.ok,
    });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
};

export const razorpayWebhook = async (c: any) => {
  try {
    const body = await c.req.text(); // important: raw body
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
      return c.json({ success: false, message: "Missing signature" }, 400);
    }

    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET_PLACEHOLDERS.has(secret)) {
      logError(
        "PAYMENT_WEBHOOK",
        new Error("RAZORPAY_WEBHOOK_SECRET is not set or is a placeholder."),
      );
      return c.json({ success: false, message: "Webhook not configured" }, 500);
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (!secureCompare(expectedSignature, signature)) {
      logError("PAYMENT_WEBHOOK", new Error("Invalid webhook signature"));
      return c.json({ success: false, message: "Invalid signature" }, 400);
    }

    const event = JSON.parse(body);

    // Handle successful payment
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      let scanId = payment?.notes?.scanId as string | undefined;

      if (!scanId && payment?.order_id) {
        try {
          const order = await razorpay.orders.fetch(payment.order_id);
          if (String(order.currency).toUpperCase() === RAZORPAY_CURRENCY) {
            scanId = order.notes?.scanId as string | undefined;
          }
        } catch (err) {
          logError("PAYMENT_WEBHOOK_ORDER_FETCH", err, {
            orderId: payment.order_id,
          });
        }
      }

      if (scanId) {
        await unlockAndGenerateReport(Number(scanId));
      }
    }

    return c.json({ success: true }, 200);
  } catch (err: any) {
    logError("PAYMENT_WEBHOOK_ERROR", err);
    return c.json({ success: false }, 500);
  }
};
