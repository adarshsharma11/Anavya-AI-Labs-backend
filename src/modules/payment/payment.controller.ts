import type { Context } from "hono";
import crypto from "crypto";
import { razorpay } from "../../lib/razorPay";
import { getScanRepo, updateScanRepo } from "../scan/scan.repository";
import { generateFullReport } from "../../lib/aiReport";

const buildFailureReport = (message: string) => {
  return {
    executiveSummary: "Report generation failed",
    technicalAnalysis: "",
    seoImprovements: [],
    performanceImprovements: [],
    businessGrowthSuggestions: [],
    estimatedTrafficImpact: "",
    error: message,
  };
};

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
    return { ok: true as const };
  } catch (err: any) {
    await updateScanRepo(scanId, {
      fullReport: buildFailureReport(err?.message || "Unknown error"),
      status: "completed",
    });
    return { ok: false as const, reason: err?.message || "Report generation failed" };
  }
};

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

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return c.json(
        { success: false, message: "RAZORPAY_KEY_SECRET is not set" },
        500,
      );
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return c.json({ success: false, message: "Invalid signature" }, 400);
    }

    if (!scanId) {
      return c.json({ success: true, message: "Payment verified" });
    }

    const numericScanId = Number(scanId);
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
  const ok = () => c.json({ success: true }, 200);
  try {
    const body = await c.req.text(); // important: raw body
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
      return ok();
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return ok();
    }

    const event = JSON.parse(body);

    // Handle successful payment
    if (event.event === "payment.captured") {
      const scanId = event.payload.payment.entity.notes.scanId;

      if (scanId) {
        await unlockAndGenerateReport(Number(scanId));
      }
    }

    return ok();
  } catch (err: any) {
    return c.json({ success: false }, 200);
  }
};
