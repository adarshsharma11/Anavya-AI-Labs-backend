import type { Context } from "hono";
import crypto from "crypto";
import { getRazorpay } from "../../lib/razorPay.js";
import { getScanRepo, updateScanRepo, type ScanRow } from "../scan/scan.repository.js";
import {
  findAccessibleScan,
  generateAndStoreReport,
  ScanNotFoundError,
} from "../scan/scan.service.js";
import { recordPaymentRepo } from "./payment.repository.js";
import { handleSubscriptionWebhook } from "../subscription/subscription.service.js";
import { runInBackground } from "../../lib/background.js";
import { normalizeEmail } from "../../lib/request.js";

import { logError } from "../../lib/errorLog.js";
import { env } from "../../config/env.js";
import {
  getPaymentQuote,
  type PaymentRegion,
} from "../../lib/paymentConfig.js";

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

const unlockScan = async (scan: ScanRow) => {
  if (!scan.isUnlocked) {
    await updateScanRepo(scan.id, {
      isUnlocked: true,
      status: scan.fullReport ? "completed" : "paid",
    });
  }
};

const recordReportPayment = async (scan: ScanRow, payment: {
  orderId?: string | null;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
}) => {
  await recordPaymentRepo({
    type: "report",
    scanId: scan.id,
    userId: scan.userId,
    razorpayOrderId: payment.orderId ?? null,
    razorpayPaymentId: payment.paymentId,
    amountSubunits: payment.amount,
    currency: payment.currency.toUpperCase(),
    status: payment.status,
  });
};

const fulfillReportPayment = async (scan: ScanRow, payment: Parameters<typeof recordReportPayment>[1]) => {
  await recordReportPayment(scan, payment);
  await unlockScan(scan);
  runInBackground("AI_REPORT_GENERATION", generateAndStoreReport(scan.id));
};

export const getQuote = async (c: Context) => {
  try {
    const region = resolveRegion(c.req.query("region"), c);
    const quote = await getPaymentQuote(region);
    return c.json({ success: true, data: quote });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
};

export const createOrder = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { scanId, region: bodyRegion } = body;
    const user = c.get("user") as { id: number; email: string } | undefined;

    if (!scanId) {
      return c.json({ success: false, message: "scanId is required" }, 400);
    }

    let scan: ScanRow;
    try {
      ({ scan } = await findAccessibleScan(String(scanId), user));
    } catch (err) {
      if (err instanceof ScanNotFoundError) {
        return c.json({ success: false, message: "Scan not found" }, 404);
      }
      throw err;
    }

    if (scan.isUnlocked) {
      return c.json(
        { success: false, code: "ALREADY_UNLOCKED", message: "This report is already unlocked", publicId: scan.publicId },
        409,
      );
    }
    if (!scan.preview) {
      return c.json({ success: false, message: "Scan is still running. Try again shortly." }, 409);
    }

    const email = normalizeEmail(body.email) ?? scan.userEmail ?? user?.email ?? null;
    if (!email) {
      return c.json(
        { success: false, code: "EMAIL_REQUIRED", message: "Enter your email so we can send your report." },
        400,
      );
    }
    if (email !== scan.userEmail) {
      await updateScanRepo(scan.id, { userEmail: email });
    }

    const region = resolveRegion(bodyRegion, c);
    const quote = await getPaymentQuote(region);

    const order = await getRazorpay().orders.create({
      amount: quote.amountSubunits,
      currency: quote.currency,
      receipt: `scan_${scan.id}_${Date.now()}`,
      notes: {
        scanId: String(scan.id),
        publicId: scan.publicId,
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
      publicId: scan.publicId,
      prefill: { email },
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

    const order = await getRazorpay().orders.fetch(razorpay_order_id);
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

    const scan = await getScanRepo(Number(order.notes?.scanId));
    const ref = String(scanId).toLowerCase();
    if (!scan || (ref !== String(scan.id) && ref !== scan.publicId.toLowerCase())) {
      return c.json(
        { success: false, message: "Payment does not match this scan" },
        400,
      );
    }

    await fulfillReportPayment(scan, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: Number(order.amount),
      currency: orderCurrency,
      status: "captured",
    });

    return c.json({
      success: true,
      message: "Payment verified",
      unlocked: true,
      publicId: scan.publicId,
    });
  } catch (e: any) {
    logError("VERIFY_PAYMENT_FAILED", e);
    return c.json({ success: false, message: e.message }, 500);
  }
};

export const DONATION_LIMITS = {
  INR: { min: 50, max: 50000 },
  USD: { min: 1, max: 500 },
} as const;

type DonationCurrency = keyof typeof DONATION_LIMITS;

export const createDonationOrder = async (c: Context) => {
  try {
    const body = await c.req.json();
    const user = c.get("user") as { id: number; email: string } | undefined;
    const currency: DonationCurrency =
      body.currency === "USD" || body.currency === "INR"
        ? body.currency
        : resolveRegion(body.region, c) === "IN" ? "INR" : "USD";
    const limits = DONATION_LIMITS[currency];
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount < limits.min || amount > limits.max) {
      return c.json(
        { success: false, code: "INVALID_AMOUNT", message: `Choose an amount between ${limits.min} and ${limits.max} ${currency}.`, limits },
        400,
      );
    }

    const email = normalizeEmail(body.email) ?? user?.email ?? "";
    if (body.email && !normalizeEmail(body.email)) {
      return c.json({ success: false, code: "INVALID_EMAIL", message: "Enter a valid email or leave it blank." }, 400);
    }
    const amountSubunits = Math.round(amount * 100);
    const order = await getRazorpay().orders.create({
      amount: amountSubunits,
      currency,
      receipt: `donation_${Date.now()}`,
      notes: {
        type: "donation",
        email,
        name: String(body.name ?? "").slice(0, 80),
        scanId: "",
        publicId: String(body.scanId ?? "").slice(0, 40),
        amountSubunits: String(amountSubunits),
      },
    });

    return c.json({
      success: true,
      order,
      amount,
      currency,
      prefill: { email, name: body.name ?? "" },
      key_id: env.RAZORPAY_KEY_ID,
    });
  } catch (e: any) {
    logError("DONATION_ORDER_FAILED", e);
    return c.json({ success: false, message: e.error?.description || e.message || "Could not start donation" }, 500);
  }
};

const recordDonation = async (input: {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  email?: string | null;
  userId?: number | null;
}) =>
  recordPaymentRepo({
    type: "donation",
    userId: input.userId ?? null,
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.paymentId,
    amountSubunits: input.amount,
    currency: input.currency.toUpperCase(),
    status: "captured",
    email: input.email || null,
  });

export const verifyDonation = async (c: Context) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await c.req.json();
    if (!env.RAZORPAY_KEY_SECRET) {
      return c.json({ success: false, message: "RAZORPAY_KEY_SECRET is not set" }, 500);
    }

    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (!secureCompare(expected, razorpay_signature)) {
      return c.json({ success: false, message: "Invalid signature" }, 400);
    }

    const order = await getRazorpay().orders.fetch(razorpay_order_id);
    if (order.notes?.type !== "donation") {
      return c.json({ success: false, message: "Not a donation order" }, 400);
    }

    const user = c.get("user") as { id: number } | undefined;
    await recordDonation({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: Number(order.amount),
      currency: String(order.currency),
      email: String(order.notes?.email || ""),
      userId: user?.id,
    });

    return c.json({ success: true, message: "Thank you for supporting the project!" });
  } catch (e: any) {
    logError("VERIFY_DONATION_FAILED", e);
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

    if (String(event.event || "").startsWith("subscription.")) {
      await handleSubscriptionWebhook(event.event, event.payload);
    }

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      let notes = (payment?.notes ?? {}) as Record<string, string | number | null>;

      if (!notes.scanId && !notes.type && payment?.order_id) {
        try {
          const order = await getRazorpay().orders.fetch(payment.order_id);
          notes = (order.notes ?? {}) as Record<string, string | number | null>;
        } catch (err) {
          logError("PAYMENT_WEBHOOK_ORDER_FETCH", err, {
            orderId: payment.order_id,
          });
        }
      }

      if (notes.type === "donation" && payment?.id) {
        await recordDonation({
          orderId: payment.order_id,
          paymentId: payment.id,
          amount: Number(payment.amount) || 0,
          currency: String(payment.currency || "INR"),
          email: String(notes.email || payment.email || ""),
        });
      }

      const scanId = notes.type === "donation" ? undefined : (notes.scanId as string | undefined);
      const scan = scanId ? await getScanRepo(Number(scanId)) : undefined;
      if (scan && payment?.id) {
        await fulfillReportPayment(scan, {
          orderId: payment.order_id,
          paymentId: payment.id,
          amount: Number(payment.amount) || 0,
          currency: String(payment.currency || "INR"),
          status: "captured",
        });
      }
    }

    return c.json({ success: true }, 200);
  } catch (err: any) {
    logError("PAYMENT_WEBHOOK_ERROR", err);
    return c.json({ success: false }, 500);
  }
};
