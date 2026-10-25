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

  `CREATE TABLE IF NOT EXISTS reviews (
    id serial PRIMARY KEY,
    name text NOT NULL,
    role_company text,
    email text,
    review text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    user_id integer,
    user_ip text,
    created_at timestamp DEFAULT now(),
    reviewed_at timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_status_created_idx ON reviews (status, created_at DESC)`,

  `ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug text`,
  `ALTER TABLE plans ADD COLUMN IF NOT EXISTS white_label boolean NOT NULL DEFAULT false`,
  `ALTER TABLE plans ADD COLUMN IF NOT EXISTS monitoring boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_unique ON plans (slug)`,
  `UPDATE plans SET
    slug = 'free', scan_limit = 5, cadence = 'forever',
    description = 'Full AI and search readiness audits for anyone getting started.',
    features = '["5 scans per day","Full AEO, GEO, technical & content audit","Homepage + up to 5 key pages","Competitor comparison","Downloadable PDF report"]'::json,
    cta = 'Start Free', badge = NULL, is_highlighted = false
  WHERE id = (SELECT min(id) FROM plans WHERE type = 'free')
    AND NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'free')`,
  `UPDATE plans SET active = false WHERE slug IS NULL AND type IN ('one_time', 'subscription')`,
  `INSERT INTO plans (slug, name, description, price, cadence, type, features, cta, scan_limit, badge, is_highlighted, white_label, monitoring, active)
  VALUES
    ('starter', 'Starter', 'More daily audits for freelancers and small sites.', 900, 'per month', 'subscription',
      '["15 scans per day","Everything in Free","Priority audit queue","Email support"]'::json,
      'Get Starter', 15, NULL, false, false, false, true),
    ('pro', 'Pro', 'For agencies and teams who audit and monitor client sites.', 2900, 'per month', 'subscription',
      '["50 scans per day","Everything in Starter","White-label PDF reports (your logo & brand)","Weekly monitoring with score-drop alerts (up to 10 sites)"]'::json,
      'Go Pro', 50, 'Most popular', true, true, true, true)
  ON CONFLICT (slug) DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS razorpay_plans (
    id serial PRIMARY KEY,
    plan_id integer NOT NULL,
    currency text NOT NULL,
    amount_subunits integer NOT NULL,
    mode text NOT NULL,
    razorpay_plan_id text NOT NULL UNIQUE,
    created_at timestamp DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS razorpay_plans_lookup_unique ON razorpay_plans (plan_id, currency, amount_subunits, mode)`,
];

for (const statement of statements) {
  await pool.query(statement);
  console.log(`✓ ${statement.split("\n")[0]}`);
}

await pool.end();
console.log("Migration complete");
