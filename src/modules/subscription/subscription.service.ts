import crypto from "crypto";
import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../db/db.js";
import { plans } from "../../db/schema/plan.js";
import { subscriptions } from "../../db/schema/subscription.js";
import { getRazorpay } from "../../lib/razorPay.js";
import { env } from "../../config/env.js";
import { recordPaymentRepo } from "../payment/payment.repository.js";
import { getUserById } from "../auth/auth.repository.js";

export const ACCESS_STATUSES = ["active", "cancel_scheduled"];

export const FREE_DAILY_SCANS = Number(process.env.FREE_DAILY_SCANS || "5");

const toDate = (unixSeconds: unknown) =>
  typeof unixSeconds === "number" && unixSeconds > 0 ? new Date(unixSeconds * 1000) : null;

export const getProPlan = async () => {
  const res = await db
    .select()
    .from(plans)
    .where(and(eq(plans.type, "subscription"), eq(plans.active, true)))
    .orderBy(asc(plans.price))
    .limit(1);
  return res[0] ?? null;
};

export const getActiveSubscription = async (userId: number) => {
  const res = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ACCESS_STATUSES),
        or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, new Date())),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return res[0] ?? null;
};

export type PlanLimits = {
  isPro: boolean;
  dailyScanLimit: number | null;
  subscription: Awaited<ReturnType<typeof getActiveSubscription>>;
};

export const getUserPlanLimits = async (userId?: number | null): Promise<PlanLimits> => {
  if (!userId) return { isPro: false, dailyScanLimit: FREE_DAILY_SCANS, subscription: null };

  const subscription = await getActiveSubscription(userId);
  if (!subscription) return { isPro: false, dailyScanLimit: FREE_DAILY_SCANS, subscription: null };

  const plan = await db.select().from(plans).where(eq(plans.id, subscription.planId));
  const limit = plan[0]?.scanLimit;
  return {
    isPro: true,
    dailyScanLimit: limit === null || limit === undefined || limit < 0 ? null : limit,
    subscription,
  };
};

export const createSubscriptionService = async (userId: number) => {
  const planId = process.env.RAZORPAY_PRO_PLAN_ID;
  if (!planId) throw new Error("Pro subscriptions are not configured yet");

  const proPlan = await getProPlan();
  if (!proPlan) throw new Error("Pro plan not found");

  if (await getActiveSubscription(userId)) {
    throw new Error("You already have an active Pro subscription");
  }

  const user = await getUserById(userId);
  const razorpaySub = await getRazorpay().subscriptions.create({
    plan_id: planId,
    total_count: 120,
    customer_notify: 1,
    notes: { userId: String(userId), planId: String(proPlan.id) },
  });

  await db.insert(subscriptions).values({
    userId,
    planId: proPlan.id,
    status: "created",
    razorpaySubId: razorpaySub.id,
  });

  return {
    subscriptionId: razorpaySub.id,
    keyId: env.RAZORPAY_KEY_ID,
    plan: { id: proPlan.id, name: proPlan.name, price: proPlan.price, cadence: proPlan.cadence },
    prefill: { email: user?.email, name: user?.name },
  };
};

const syncFromRazorpay = async (razorpaySubId: string, statusOverride?: string) => {
  const remote: any = await getRazorpay().subscriptions.fetch(razorpaySubId);
  const status = statusOverride ?? mapRazorpayStatus(remote.status);
  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodEnd: toDate(remote.current_end),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.razorpaySubId, razorpaySubId));
  return { status, currentPeriodEnd: toDate(remote.current_end) };
};

const mapRazorpayStatus = (status: string) => {
  if (status === "active" || status === "authenticated") return "active";
  if (status === "cancelled" || status === "completed" || status === "expired") return "cancelled";
  if (status === "halted" || status === "pending") return "past_due";
  return status;
};

export const verifySubscriptionService = async (
  userId: number,
  body: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string },
) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body;
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    throw new Error("Missing payment details");
  }
  if (!env.RAZORPAY_KEY_SECRET) throw new Error("RAZORPAY_KEY_SECRET is not set");

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");
  if (
    expected.length !== razorpay_signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))
  ) {
    throw new Error("Invalid signature");
  }

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubId, razorpay_subscription_id));
  if (!row || row.userId !== userId) throw new Error("Subscription not found");

  const synced = await syncFromRazorpay(razorpay_subscription_id, "active");
  await recordSubscriptionPayment(razorpay_payment_id, row.id, userId);

  return { status: synced.status, currentPeriodEnd: synced.currentPeriodEnd };
};

const recordSubscriptionPayment = async (
  paymentId: string,
  subscriptionId: number,
  userId: number,
  entity?: any,
) => {
  const payment = entity ?? (await getRazorpay().payments.fetch(paymentId));
  await recordPaymentRepo({
    type: "subscription",
    subscriptionId,
    userId,
    razorpayOrderId: payment.order_id ?? null,
    razorpayPaymentId: paymentId,
    amountSubunits: Number(payment.amount) || 0,
    currency: String(payment.currency || "INR").toUpperCase(),
    status: String(payment.status || "captured"),
  });
};

export const cancelSubscriptionService = async (userId: number) => {
  const sub = await getActiveSubscription(userId);
  if (!sub?.razorpaySubId) throw new Error("No active subscription");

  await getRazorpay().subscriptions.cancel(sub.razorpaySubId, true);
  await db
    .update(subscriptions)
    .set({ status: "cancel_scheduled", updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  return { status: "cancel_scheduled", currentPeriodEnd: sub.currentPeriodEnd };
};

export const getSubscriptionStatusService = async (userId: number) => {
  const limits = await getUserPlanLimits(userId);
  return {
    isPro: limits.isPro,
    dailyScanLimit: limits.dailyScanLimit,
    status: limits.subscription?.status ?? "none",
    currentPeriodEnd: limits.subscription?.currentPeriodEnd ?? null,
  };
};

export const handleSubscriptionWebhook = async (eventName: string, payload: any) => {
  const entity = payload?.subscription?.entity;
  if (!entity?.id) return;

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubId, entity.id));
  if (!row) return;

  const status =
    eventName === "subscription.cancelled" || eventName === "subscription.completed"
      ? "cancelled"
      : row.status === "cancel_scheduled" && mapRazorpayStatus(entity.status) === "active"
        ? "cancel_scheduled"
        : mapRazorpayStatus(entity.status);

  await db
    .update(subscriptions)
    .set({ status, currentPeriodEnd: toDate(entity.current_end) ?? row.currentPeriodEnd, updatedAt: new Date() })
    .where(eq(subscriptions.id, row.id));

  const payment = payload?.payment?.entity;
  if (eventName === "subscription.charged" && payment?.id) {
    await recordSubscriptionPayment(payment.id, row.id, row.userId, payment);
  }
};
