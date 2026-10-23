import { pool } from "./db.js";

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  `ALTER TABLE scans ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS scans_public_id_unique ON scans (public_id)`,
  `ALTER TABLE scans ADD COLUMN IF NOT EXISTS report_started_at timestamp`,
  `CREATE INDEX IF NOT EXISTS scans_user_id_idx ON scans (user_id)`,

  `ALTER TABLE blogs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    plan_id integer NOT NULL,
    status text NOT NULL,
    stripe_sub_id text,
    current_period_end timestamp,
    created_at timestamp DEFAULT now()
  )`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_sub_id text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_razorpay_sub_id_unique ON subscriptions (razorpay_sub_id)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,

  `CREATE TABLE IF NOT EXISTS payments (
    id serial PRIMARY KEY,
    type text NOT NULL,
    scan_id integer,
    user_id integer,
    subscription_id integer,
    razorpay_order_id text,
    razorpay_payment_id text NOT NULL UNIQUE,
    amount_subunits integer NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS rate_limits (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 0,
    window_start timestamp NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS geo_checks (
    id serial PRIMARY KEY,
    url text NOT NULL,
    email text,
    user_id integer,
    user_ip text,
    score integer NOT NULL,
    result json NOT NULL,
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS monitors (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    url text NOT NULL,
    last_scan_id integer,
    last_score integer,
    last_checked_at timestamp,
    created_at timestamp DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS report_pdfs (
    scan_id integer NOT NULL,
    variant text NOT NULL,
    content_base64 text NOT NULL,
    created_at timestamp DEFAULT now(),
    PRIMARY KEY (scan_id, variant)
  )`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS email text`,
  `CREATE INDEX IF NOT EXISTS scans_normalized_url_created_idx ON scans (normalized_url, created_at DESC)`,
];

for (const statement of statements) {
  await pool.query(statement);
  console.log(`✓ ${statement.split("\n")[0]}`);
}

await pool.end();
console.log("Migration complete");
