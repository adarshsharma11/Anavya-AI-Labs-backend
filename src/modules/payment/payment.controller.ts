import type { Context } from "hono";
import crypto from "crypto";
import { razorpay } from "../../lib/razorPay";
import { getScanRepo, updateScanRepo } from "../scan/scan.repository";
import { generateFullReport } from "../../lib/aiReport";
import { sendReportReadyEmail } from "../../lib/sendOTP";
import { getUserById } from "../auth/auth.repository";

import { logError } from "../../lib/errorLog";
import { env } from "../../config/env";
import {
  getPaymentQuote,
  type PaymentRegion,
} from "../../lib/paymentConfig";

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

function resolveRegion(
  value: unknown,
  c: Context,
): PaymentRegion {
  if (value === "IN" || value === "INTL") return value;

  const header = c.req.header("x-client-region");
  if (header === "IN" || header === "INTL") return header;

  const cfCountry = c.req.header("cf-ipcountry");
  if (cfCountry === "IN") return "IN";

  return "INTL";
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
    await updateScanRepo(scanId, { status: "completed" });
    return { ok: false as const, reason: err?.message || "Report generation failed" };
  }
};

export const getQuote = async (c: Context) => {
  try {
    const region = resolveRegion(c.req.query("region"), c);
    const quote = getPaymentQuote(region);
    return c.json({ success: true, data: quote });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
};

export const createOrder = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { scanId, region: bodyRegion } = body;

    if (!scanId) {
      return c.json({ success: false, message: "scanId is required" }, 400);
    }

    const region = resolveRegion(bodyRegion, c);
    const quote = getPaymentQuote(region);

    const order = await razorpay.orders.create({
      amount: quote.amountSubunits,
      currency: quote.currency,
      receipt: `scan_${scanId}_${Date.now()}`,
      notes: {
        scanId: String(scanId),
        region: quote.region,
        total: String(quote.total),
        currency: quote.currency,
        amountSubunits: String(quote.amountSubunits),
        gst_inclusive: "true",
        gst_rate: `${quote.gstRatePercent}%`,
      },
    });

    if (String(order.currency).toUpperCase() !== quote.currency) {
      return c.json(
        { success: false, message: "Order currency mismatch" },
        500,
      );
    }

    return c.json({
      success: true,
      order,
      quote,
      key_id: env.RAZORPAY_KEY_ID,
    });
  } catch (e: any) {
    logError("CREATE_ORDER_FAILED", e);
    const errorMsg = e.error?.description || e.message || "Order creation failed";
    return c.json({ success: false, message: errorMsg }, 500);
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
    const notesCurrency = String(order.notes?.currency || "").toUpperCase();
    const orderCurrency = String(order.currency).toUpperCase();

    if (notesCurrency && orderCurrency !== notesCurrency) {
      return c.json({ success: false, message: "Invalid order currency" }, 400);
    }

    const expectedSubunits = Number(order.notes?.amountSubunits);
    if (
      !Number.isFinite(expectedSubunits) ||
      Number(order.amount) !== expectedSubunits
    ) {
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
    const body = await c.req.text();
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
      return c.json({ success: false, message: "Missing signature" }, 400);
    }

    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (WEBHOOK_SECRET_PLACEHOLDERS.has(secret)) {
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

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      let scanId = payment?.notes?.scanId as string | undefined;

      if (!scanId && payment?.order_id) {
        try {
          const order = await razorpay.orders.fetch(payment.order_id);
          scanId = order.notes?.scanId as string | undefined;
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
