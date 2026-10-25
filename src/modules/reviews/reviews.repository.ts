import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "../../db/db.js";
import { reviews, type ReviewStatus } from "../../db/schema/reviews.js";

export const PUBLIC_REVIEW_FIELDS = {
  id: reviews.id,
  name: reviews.name,
  roleCompany: reviews.roleCompany,
  review: reviews.review,
  createdAt: reviews.createdAt,
};

export const createReviewRepo = async (data: typeof reviews.$inferInsert) => {
  const [row] = await db.insert(reviews).values(data).returning({ id: reviews.id, status: reviews.status });
  return row;
};

export const findDuplicateReviewRepo = async (userIp: string, text: string) => {
  const [row] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.userIp, userIp), eq(reviews.review, text)))
    .limit(1);
  return row;
};

const paginate = async <T>(where: SQL | undefined, page: number, limit: number, fields: T) => {
  const [rows, [total]] = await Promise.all([
    db
      .select(fields as any)
      .from(reviews)
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(reviews).where(where),
  ]);
  return { items: rows, total: Number(total?.value ?? 0), page, limit };
};

export const listApprovedReviewsRepo = (page: number, limit: number) =>
  paginate(eq(reviews.status, "approved"), page, limit, PUBLIC_REVIEW_FIELDS);

export const listReviewsRepo = (status: ReviewStatus | undefined, page: number, limit: number) =>
  paginate(status ? eq(reviews.status, status) : undefined, page, limit, {
    ...PUBLIC_REVIEW_FIELDS,
    email: reviews.email,
    status: reviews.status,
    userId: reviews.userId,
    reviewedAt: reviews.reviewedAt,
  });

export const countReviewsByStatusRepo = async () => {
  const rows = await db.select({ status: reviews.status, value: count() }).from(reviews).groupBy(reviews.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.value)]));
};

export const updateReviewStatusRepo = async (id: number, status: ReviewStatus) => {
  const [row] = await db
    .update(reviews)
    .set({ status, reviewedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id, status: reviews.status, reviewedAt: reviews.reviewedAt });
  return row;
};

export const deleteReviewRepo = async (id: number) => {
  const [row] = await db.delete(reviews).where(eq(reviews.id, id)).returning({ id: reviews.id });
  return row;
};
