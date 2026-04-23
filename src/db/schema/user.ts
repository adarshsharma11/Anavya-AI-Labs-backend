import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  username: text("username").unique(),
  email: text("email").unique().notNull(),
  phoneNumber: text("phone_number"),
  password: text("password"),
  authProvider: text("auth_provider").default("local"),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  companyName: text("company_name"),
  companyLogoUrl: text("company_logo_url"),

  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
