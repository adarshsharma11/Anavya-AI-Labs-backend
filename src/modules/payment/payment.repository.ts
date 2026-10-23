import { db } from "../../db/db.js";
import { payments } from "../../db/schema/payments.js";

export type NewPayment = typeof payments.$inferInsert;

export const recordPaymentRepo = async (data: NewPayment) => {
  const res = await db
    .insert(payments)
    .values(data)
    .onConflictDoNothing({ target: payments.razorpayPaymentId })
    .returning({ id: payments.id });
  return res.length > 0;
};
