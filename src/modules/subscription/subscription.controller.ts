import type { Context } from "hono";
import {
  cancelSubscriptionService,
  createSubscriptionService,
  getSubscriptionStatusService,
  SubscriptionError,
  verifySubscriptionService,
} from "./subscription.service.js";
import { resolveRegion } from "../../lib/paymentConfig.js";
import { logError } from "../../lib/errorLog.js";

const currentUserId = (c: Context) => (c.get("user") as { id: number }).id;

const fail = (c: Context, context: string, e: any) => {
  if (!(e instanceof SubscriptionError)) logError(context, e);
  const message = e?.error?.description || e?.message || "Request failed";
  return c.json({ success: false, code: e instanceof SubscriptionError ? e.code : undefined, message }, 400);
};

export const createSubscription = async (c: Context) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const planRef = body.plan ?? body.slug ?? body.planSlug ?? body.planId ?? body.plan_id ?? c.req.query("plan");
    const data = await createSubscriptionService(currentUserId(c), planRef, resolveRegion(body.region, c));
    return c.json({ success: true, data });
  } catch (e) {
    return fail(c, "SUBSCRIPTION_CREATE", e);
  }
};

export const verifySubscription = async (c: Context) => {
  try {
    const data = await verifySubscriptionService(currentUserId(c), await c.req.json());
    return c.json({ success: true, data });
  } catch (e) {
    return fail(c, "SUBSCRIPTION_VERIFY", e);
  }
};

export const getSubscription = async (c: Context) => {
  try {
    const data = await getSubscriptionStatusService(currentUserId(c));
    return c.json({ success: true, data });
  } catch (e) {
    return fail(c, "SUBSCRIPTION_STATUS", e);
  }
};

export const cancelSubscription = async (c: Context) => {
  try {
    const data = await cancelSubscriptionService(currentUserId(c));
    return c.json({ success: true, data });
  } catch (e) {
    return fail(c, "SUBSCRIPTION_CANCEL", e);
  }
};
