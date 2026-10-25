import crypto from "crypto";
import { and, desc, eq, gt, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "../../db/db.js";
import { plans } from "../../db/schema/plan.js";
import { subscriptions } from "../../db/schema/subscription.js";
import { razorpayPlans } from "../../db/schema/razorpayPlans.js";
import { getRazorpay } from "../../lib/razorPay.js";
import { env } from "../../config/env.js";
import { quoteUsd, type PaymentQuote, type PaymentRegion } from "../../lib/paymentConfig.js";
import { getUsdToInrRate } from "../../lib/fx.js";
import { logError } from "../../lib/errorLog.js";
import { recordPaymentRepo } from "../payment/payment.repository.js";
import { getUserById } from "../auth/auth.repository.js";

export const ACCESS_STATUSES = ["active", "cancel_scheduled"];

/** Used only if the free plan row has no scan limit. */
export const FREE_DAILY_SCANS = Number(process.env.FREE_DAILY_SCANS || "5");

export class SubscriptionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type Plan = typeof plans.$inferSelect;

const toDate = (unixSeconds: unknown) =>
  typeof unixSeconds === "number" && unixSeconds > 0 ? new Date(unixSeconds * 1000) : null;

const toDailyLimit = (scanLimit: number | null | undefined) =>
  scanLimit === null || scanLimit === undefined || scanLimit < 0 ? null : scanLimit;

const razorpayMode = () => (env.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "live" : "test");

export const getActivePlanBySlug = async (slug: string) => {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.slug, slug), eq(plans.active, true)))
    .limit(1);
  return plan ?? null;
};

/** Accepts a plan slug ("pro"), name ("Pro") or id (2 / "2"). */
export const findSubscriptionPlan = async (ref: unknown) => {
  if (typeof ref !== "string" && typeof ref !== "number") return null;
  const value = String(ref).trim();
  if (!value) return null;

  const id = /^\d+$/.test(value) ? Number(value) : null;
  const [plan] = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.active, true),
        eq(plans.type, "subscription"),
        id !== null ? eq(plans.id, id) : or(eq(plans.slug, value.toLowerCase()), ilike(plans.name, value)),
      ),
    )
    .limit(1);
  return plan ?? null;
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
  plan: { id: number | null; slug: string; name: string };
  isPaid: boolean;
  isPro: boolean;
  dailyScanLimit: number | null;
  whiteLabel: boolean;
  monitoring: boolean;
  subscription: Awaited<ReturnType<typeof getActiveSubscription>>;
};

const freeLimits = async (): Promise<PlanLimits> => {
  const free = await getActivePlanBySlug("free").catch(() => null);
  const limit = free?.scanLimit && free.scanLimit > 0 ? free.scanLimit : FREE_DAILY_SCANS;
  return {
    plan: { id: free?.id ?? null, slug: "free", name: free?.name ?? "Free" },
    isPaid: false,
    isPro: false,
    dailyScanLimit: limit,
    whiteLabel: false,
    monitoring: false,
    subscription: null,
  };
};

export const getUserPlanLimits = async (userId?: number | null): Promise<PlanLimits> => {
  if (!userId) return freeLimits();

  const subscription = await getActiveSubscription(userId);
  if (!subscription) return freeLimits();

  const [plan] = await db.select().from(plans).where(eq(plans.id, subscription.planId));
  if (!plan) return freeLimits();

  return {
    plan: { id: plan.id, slug: plan.slug ?? "paid", name: plan.name },
    isPaid: true,
    isPro: plan.slug === "pro",
    dailyScanLimit: toDailyLimit(plan.scanLimit),
    whiteLabel: plan.whiteLabel,
    monitoring: plan.monitoring,
    subscription,
  };
};

const createRazorpayPlan = async (plan: Plan, currency: string, amountSubunits: number) => {
  const mode = razorpayMode();
  const [existing] = await db
    .select({ id: razorpayPlans.razorpayPlanId })
    .from(razorpayPlans)
    .where(
      and(
        eq(razorpayPlans.planId, plan.id),
        eq(razorpayPlans.currency, currency),
        eq(razorpayPlans.amountSubunits, amountSubunits),
        eq(razorpayPlans.mode, mode),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const created: any = await getRazorpay().plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `${plan.name} (${currency})`,
      amount: amountSubunits,
      currency,
      description: plan.description ?? `${plan.name} monthly plan`,
    },
    notes: { planId: String(plan.id), slug: plan.slug ?? "" },
  });

  await db
    .insert(razorpayPlans)
    .values({ planId: plan.id, currency, amountSubunits, mode, razorpayPlanId: created.id })
    .onConflictDoNothing();
  return created.id as string;
};

/** Returns a Razorpay plan matching the current price. If USD billing isn't enabled on the account, international customers are billed the INR equivalent without GST. */
const ensureRazorpayPlan = async (plan: Plan, quote: PaymentQuote): Promise<{ razorpayPlanId: string; quote: PaymentQuote }> => {
  try {
    return { razorpayPlanId: await createRazorpayPlan(plan, quote.currency, quote.amountSubunits), quote };
  } catch (err) {
    if (quote.currency !== "USD") throw err;
    logError("RAZORPAY_USD_PLAN", err, { planId: plan.id });
    const rate = await getUsdToInrRate();
    const base = Math.round(quote.total * rate);
    const inrQuote: PaymentQuote = {
      region: "INTL",
      currency: "INR",
      base,
      gstAmount: 0,
      gstRatePercent: 0,
      total: base,
      amountSubunits: base * 100,
      usdToInrRate: Math.round(rate * 100) / 100,
    };
    return { razorpayPlanId: await createRazorpayPlan(plan, "INR", inrQuote.amountSubunits), quote: inrQuote };
  }
};

export const createSubscriptionService = async (userId: number, planRef: unknown, region: PaymentRegion) => {
  const plan = await findSubscriptionPlan(planRef);
  if (!plan) {
    throw new SubscriptionError('Choose a valid plan: send { "plan": "starter" } or { "plan": "pro" }.', "INVALID_PLAN");
  }

  const current = await getActiveSubscription(userId);
  if (current?.planId === plan.id) {
    throw new SubscriptionError(`You're already on the ${plan.name} plan.`, "ALREADY_SUBSCRIBED");
  }

  const { razorpayPlanId, quote } = await ensureRazorpayPlan(plan, await quoteUsd(plan.price / 100, region));
  const user = await getUserById(userId);
  const razorpaySub: any = await getRazorpay().subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: 120,
    customer_notify: 1,
    notes: { userId: String(userId), planId: String(plan.id), slug: plan.slug ?? "" },
  });

  await db.insert(subscriptions).values({
    userId,
    planId: plan.id,
    status: "created",
    razorpaySubId: razorpaySub.id,
  });

  let replaces: string | null = null;
  if (current) {
    const [currentPlan] = await db.select({ slug: plans.slug }).from(plans).where(eq(plans.id, current.planId));
    replaces = currentPlan?.slug ?? null;
  }

  return {
    subscriptionId: razorpaySub.id as string,
    keyId: env.RAZORPAY_KEY_ID,
    plan: { id: plan.id, slug: plan.slug, name: plan.name, priceUsd: plan.price / 100, cadence: plan.cadence },
    quote,
    replaces,
    prefill: { email: user?.email, name: user?.name },
  };
};

const mapRazorpayStatus = (status: string) => {
  if (status === "active" || status === "authenticated") return "active";
  if (status === "cancelled" || status === "completed" || status === "expired") return "cancelled";
  if (status === "halted" || status === "pending") return "past_due";
  return status;
};

const syncFromRazorpay = async (razorpaySubId: string, statusOverride?: string) => {
  const remote: any = await getRazorpay().subscriptions.fetch(razorpaySubId);
  const status = statusOverride ?? mapRazorpayStatus(remote.status);
  await db
    .update(subscriptions)
    .set({ status, currentPeriodEnd: toDate(remote.current_end), updatedAt: new Date() })
    .where(eq(subscriptions.razorpaySubId, razorpaySubId));
  return { status, currentPeriodEnd: toDate(remote.current_end) };
};

/** A user keeps one paid plan: switching plans cancels the previous subscription once the new one is active. */
const cancelOtherSubscriptions = async (userId: number, keepSubscriptionId: number) => {
  const others = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        ne(subscriptions.id, keepSubscriptionId),
        inArray(subscriptions.status, [...ACCESS_STATUSES, "past_due"]),
      ),
    );

  for (const sub of others) {
    try {
      if (sub.razorpaySubId) await getRazorpay().subscriptions.cancel(sub.razorpaySubId, false);
    } catch (err) {
      logError("SUBSCRIPTION_SWITCH_CANCEL", err, { subscriptionId: sub.id });
    }
    await db.update(subscriptions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
  }
};

export const verifySubscriptionService = async (
  userId: number,
  body: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string },
) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body;
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    throw new SubscriptionError("Missing payment details");
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
    throw new SubscriptionError("Invalid signature");
  }

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubId, razorpay_subscription_id));
  if (!row || row.userId !== userId) throw new SubscriptionError("Subscription not found");

  const synced = await syncFromRazorpay(razorpay_subscription_id, "active");
  await recordSubscriptionPayment(razorpay_payment_id, row.id, userId);
  await cancelOtherSubscriptions(userId, row.id);

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
  if (!sub?.razorpaySubId) throw new SubscriptionError("No active subscription", "NO_SUBSCRIPTION");

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
    plan: limits.plan,
    isPaid: limits.isPaid,
    isPro: limits.isPro,
    dailyScanLimit: limits.dailyScanLimit,
    whiteLabel: limits.whiteLabel,
    monitoring: limits.monitoring,
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

  if (status === "active") await cancelOtherSubscriptions(row.userId, row.id);

  const payment = payload?.payment?.entity;
  if (eventName === "subscription.charged" && payment?.id) {
    await recordSubscriptionPayment(payment.id, row.id, row.userId, payment);
  }
};
