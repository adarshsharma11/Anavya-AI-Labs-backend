import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // report | subscription | donation
  scanId: integer("scan_id"),
  userId: integer("user_id"),
  subscriptionId: integer("subscription_id"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id").notNull().unique(),
  amountSubunits: integer("amount_subunits").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});
