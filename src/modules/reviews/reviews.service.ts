import { REVIEW_STATUSES, type ReviewStatus } from "../../db/schema/reviews.js";
import { normalizeEmail } from "../../lib/request.js";
import {
  countReviewsByStatusRepo,
  createReviewRepo,
  deleteReviewRepo,
  findDuplicateReviewRepo,
  listApprovedReviewsRepo,
  listReviewsRepo,
  updateReviewStatusRepo,
} from "./reviews.repository.js";

export const REVIEW_LIMITS = {
  name: { min: 2, max: 80 },
  roleCompany: { max: 120 },
  review: { min: 10, max: 2000 },
} as const;

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
    readonly field?: string,
  ) {
    super(message);
  }
}

const plainText = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : "";

export type ReviewInput = {
  name?: unknown;
  roleCompany?: unknown;
  email?: unknown;
  review?: unknown;
  website?: unknown;
};

export const validateReview = (input: ReviewInput) => {
  const name = plainText(input.name);
  const roleCompany = plainText(input.roleCompany);
  const review = plainText(input.review);
  const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
  const email = rawEmail ? normalizeEmail(rawEmail) : null;

  if (name.length < REVIEW_LIMITS.name.min || name.length > REVIEW_LIMITS.name.max) {
    throw new ReviewError(`Name must be ${REVIEW_LIMITS.name.min}–${REVIEW_LIMITS.name.max} characters.`, 400, "name");
  }
  if (roleCompany.length > REVIEW_LIMITS.roleCompany.max) {
    throw new ReviewError(`Role / Company must be at most ${REVIEW_LIMITS.roleCompany.max} characters.`, 400, "roleCompany");
  }
  if (rawEmail && !email) {
    throw new ReviewError("Enter a valid email or leave it blank.", 400, "email");
  }
  if (review.length < REVIEW_LIMITS.review.min || review.length > REVIEW_LIMITS.review.max) {
    throw new ReviewError(`Review must be ${REVIEW_LIMITS.review.min}–${REVIEW_LIMITS.review.max} characters.`, 400, "review");
  }

  return { name, roleCompany: roleCompany || null, email, review };
};

export const isSpamSubmission = (input: ReviewInput) => typeof input.website === "string" && input.website.trim() !== "";

export const submitReviewService = async (input: ReviewInput, meta: { userIp: string; userId?: number | null }) => {
  const data = validateReview(input);
  if (await findDuplicateReviewRepo(meta.userIp, data.review)) return { duplicate: true as const };
  const row = await createReviewRepo({ ...data, userIp: meta.userIp, userId: meta.userId ?? null, status: "pending" });
  return { duplicate: false as const, id: row?.id };
};

const pageParams = (page: unknown, limit: unknown, maxLimit: number) => ({
  page: Math.max(1, Math.floor(Number(page)) || 1),
  limit: Math.min(maxLimit, Math.max(1, Math.floor(Number(limit)) || 12)),
});

export const listPublicReviewsService = (page: unknown, limit: unknown) => {
  const p = pageParams(page, limit, 50);
  return listApprovedReviewsRepo(p.page, p.limit);
};

export const parseReviewStatus = (value: unknown): ReviewStatus | undefined =>
  REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as ReviewStatus) : undefined;

export const listAdminReviewsService = async (status: unknown, page: unknown, limit: unknown) => {
  const p = pageParams(page, limit, 100);
  const [list, counts] = await Promise.all([listReviewsRepo(parseReviewStatus(status), p.page, p.limit), countReviewsByStatusRepo()]);
  return {
    ...list,
    counts: { pending: counts.pending ?? 0, approved: counts.approved ?? 0, rejected: counts.rejected ?? 0 },
  };
};

export const setReviewStatusService = async (id: number, status: unknown) => {
  const next = parseReviewStatus(status);
  if (!next) throw new ReviewError(`Status must be one of: ${REVIEW_STATUSES.join(", ")}.`, 400, "status");
  const row = await updateReviewStatusRepo(id, next);
  if (!row) throw new ReviewError("Review not found", 404);
  return row;
};

export const deleteReviewService = async (id: number) => {
  if (!(await deleteReviewRepo(id))) throw new ReviewError("Review not found", 404);
};
