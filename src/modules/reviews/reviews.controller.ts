import type { Context } from "hono";
import { consumeRateLimit } from "../../lib/rateLimiter.js";
import { getClientIp } from "../../lib/request.js";
import { logError } from "../../lib/errorLog.js";
import {
  deleteReviewService,
  isSpamSubmission,
  listAdminReviewsService,
  listPublicReviewsService,
  ReviewError,
  setReviewStatusService,
  submitReviewService,
  validateReview,
} from "./reviews.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEWS_PER_IP_PER_DAY = 3;
const THANK_YOU = "Thank you! Your review will appear once it's approved.";

const fail = (c: Context, context: string, err: any) => {
  if (err instanceof ReviewError) {
    return c.json({ success: false, code: "INVALID_REVIEW", field: err.field, message: err.message }, err.status);
  }
  logError(context, err);
  return c.json({ success: false, message: "Something went wrong. Please try again." }, 500);
};

const reviewId = (c: Context) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw new ReviewError("Review not found", 404);
  return id;
};

export const submitReview = async (c: Context) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (isSpamSubmission(body)) return c.json({ success: true, message: THANK_YOU }, 201);
    validateReview(body);

    const ip = getClientIp(c);
    if (!(await consumeRateLimit(`review:${ip}`, REVIEWS_PER_IP_PER_DAY, DAY_MS))) {
      return c.json(
        { success: false, code: "RATE_LIMITED", message: "You've already shared a few reviews today. Please try again tomorrow." },
        429,
      );
    }

    const user = c.get("user") as { id: number } | undefined;
    await submitReviewService(body, { userIp: ip, userId: user?.id });
    return c.json({ success: true, message: THANK_YOU }, 201);
  } catch (err) {
    return fail(c, "REVIEW_SUBMIT", err);
  }
};

export const getPublicReviews = async (c: Context) => {
  try {
    const data = await listPublicReviewsService(c.req.query("page"), c.req.query("limit"));
    c.header("Cache-Control", "public, max-age=60, s-maxage=300");
    return c.json({ success: true, data });
  } catch (err) {
    return fail(c, "REVIEW_LIST", err);
  }
};

export const getAdminReviews = async (c: Context) => {
  try {
    const data = await listAdminReviewsService(c.req.query("status"), c.req.query("page"), c.req.query("limit"));
    return c.json({ success: true, data });
  } catch (err) {
    return fail(c, "ADMIN_REVIEW_LIST", err);
  }
};

export const updateReviewStatus = async (c: Context) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const data = await setReviewStatusService(reviewId(c), body.status);
    return c.json({ success: true, data });
  } catch (err) {
    return fail(c, "ADMIN_REVIEW_UPDATE", err);
  }
};

export const deleteReview = async (c: Context) => {
  try {
    await deleteReviewService(reviewId(c));
    return c.json({ success: true });
  } catch (err) {
    return fail(c, "ADMIN_REVIEW_DELETE", err);
  }
};
