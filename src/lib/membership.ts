import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

export type BillingInterval = "one_time" | "monthly";

export type MembershipPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: BillingInterval;
  paypalPlanId: string | null;
  features: string[];
  isActive: boolean;
  sortOrder: number;
};

export type SubscriptionStatus = "pending" | "active" | "cancelled" | "expired" | "past_due";

export type MembershipSubscription = {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  paypalSubscriptionId: string | null;
  paypalOrderId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentStatus = "created" | "captured" | "failed" | "refunded";

export type MembershipPayment = {
  id: string;
  userId: string;
  subscriptionId: string | null;
  planId: string;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

let client: ReturnType<typeof createClient> | null = null;
let membershipTablesReady = false;

function getMembershipClient() {
  if (client) return client;
  const url = process.env.MUSIC_TURSO_DATABASE_URL;
  const authToken = process.env.MUSIC_TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Music production database is not configured");
  }
  client = createClient({ url, authToken });
  return client;
}

function isoNow() {
  return new Date().toISOString();
}

type PlanSeed = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingInterval: BillingInterval;
  features: string[];
  sortOrder: number;
};

const PLAN_SEEDS: PlanSeed[] = [
  {
    id: "free",
    name: "Free",
    description: "Explore the toolkit with the essentials. No payment required.",
    priceCents: 0,
    currency: "USD",
    billingInterval: "one_time",
    features: ["Toolkit theory tabs", "Community prompt presets", "Local DAW drafts"],
    sortOrder: 0,
  },
  {
    id: "pro",
    name: "Pro Creator",
    description: "Monthly membership for serious songwriters. Recurring via PayPal.",
    priceCents: 999,
    currency: "USD",
    billingInterval: "monthly",
    features: [
      "Everything in Free",
      "Unlimited song partitures",
      "Multitrack DAW sessions",
      "Priority prompt runs",
    ],
    sortOrder: 1,
  },
  {
    id: "lifetime",
    name: "Studio Lifetime",
    description: "One-time payment, yours forever. Single PayPal checkout.",
    priceCents: 14900,
    currency: "USD",
    billingInterval: "one_time",
    features: [
      "Everything in Pro Creator",
      "Lifetime access, no renewal",
      "Early access to new tools",
    ],
    sortOrder: 2,
  },
];

function mapPlanRow(row: Record<string, unknown>): MembershipPlan {
  let features: string[] = [];
  try {
    const parsed = JSON.parse(String(row.features_json ?? "[]"));
    if (Array.isArray(parsed)) features = parsed.map(String);
  } catch {
    features = [];
  }
  return {
    id: String(row.id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    priceCents: Number(row.price_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    billingInterval: (row.billing_interval as BillingInterval) ?? "one_time",
    paypalPlanId: (row.paypal_plan_id as string | null) ?? null,
    features,
    isActive: Number(row.is_active ?? 1) === 1,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapSubscriptionRow(row: Record<string, unknown>): MembershipSubscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    planId: String(row.plan_id),
    status: row.status as SubscriptionStatus,
    paypalSubscriptionId: (row.paypal_subscription_id as string | null) ?? null,
    paypalOrderId: (row.paypal_order_id as string | null) ?? null,
    currentPeriodStart: (row.current_period_start as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    cancelAtPeriodEnd: Number(row.cancel_at_period_end ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function ensureMembershipTables() {
  if (membershipTablesReady) return;
  const db = getMembershipClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS membership_plans (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      description text,
      price_cents integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'USD',
      billing_interval text NOT NULL DEFAULT 'one_time',
      paypal_plan_id text,
      features_json text NOT NULL DEFAULT '[]',
      is_active integer NOT NULL DEFAULT 1,
      sort_order integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS membership_subscriptions (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      plan_id text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      paypal_subscription_id text,
      paypal_order_id text,
      current_period_start text,
      current_period_end text,
      cancel_at_period_end integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS membership_subscriptions_user_idx
    ON membership_subscriptions (user_id, status)
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS membership_subscriptions_paypal_sub_idx
    ON membership_subscriptions (paypal_subscription_id)
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS membership_payments (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      subscription_id text,
      plan_id text NOT NULL,
      paypal_order_id text,
      paypal_capture_id text,
      amount_cents integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'USD',
      status text NOT NULL DEFAULT 'created',
      raw_json text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS membership_payments_user_idx
    ON membership_payments (user_id, created_at)
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS membership_payments_order_idx
    ON membership_payments (paypal_order_id)
  `);

  // Seed plans (insert missing, refresh copy for paid plans to keep pricing in sync).
  for (const seed of PLAN_SEEDS) {
    const existing = await db.execute({
      sql: "SELECT id FROM membership_plans WHERE id = ?",
      args: [seed.id],
    });
    if (existing.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO membership_plans
          (id, name, description, price_cents, currency, billing_interval, features_json, is_active, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        args: [
          seed.id,
          seed.name,
          seed.description,
          seed.priceCents,
          seed.currency,
          seed.billingInterval,
          JSON.stringify(seed.features),
          seed.sortOrder,
          isoNow(),
          isoNow(),
        ],
      });
    }
  }

  membershipTablesReady = true;
}

export async function listPlans(): Promise<MembershipPlan[]> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute(
    "SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order ASC",
  );
  return result.rows.map((row) => mapPlanRow(row as Record<string, unknown>));
}

export async function getPlan(planId: string): Promise<MembershipPlan | null> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute({
    sql: "SELECT * FROM membership_plans WHERE id = ?",
    args: [planId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapPlanRow(row) : null;
}

export async function setPlanPaypalId(planId: string, paypalPlanId: string) {
  await ensureMembershipTables();
  const db = getMembershipClient();
  await db.execute({
    sql: "UPDATE membership_plans SET paypal_plan_id = ?, updated_at = ? WHERE id = ?",
    args: [paypalPlanId, isoNow(), planId],
  });
}

export async function getUserSubscription(userId: string): Promise<(MembershipSubscription & { plan: MembershipPlan | null }) | null> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute({
    sql: `SELECT * FROM membership_subscriptions WHERE user_id = ?
          ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'past_due' THEN 2 ELSE 3 END, updated_at DESC
          LIMIT 1`,
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const subscription = mapSubscriptionRow(row);
  const plan = await getPlan(subscription.planId);
  return { ...subscription, plan };
}

export async function findSubscriptionByPaypalId(paypalSubscriptionId: string): Promise<MembershipSubscription | null> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute({
    sql: "SELECT * FROM membership_subscriptions WHERE paypal_subscription_id = ? LIMIT 1",
    args: [paypalSubscriptionId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapSubscriptionRow(row) : null;
}

export async function findSubscriptionByOrderId(paypalOrderId: string): Promise<MembershipSubscription | null> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute({
    sql: "SELECT * FROM membership_subscriptions WHERE paypal_order_id = ? LIMIT 1",
    args: [paypalOrderId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapSubscriptionRow(row) : null;
}

export async function createSubscription(input: {
  userId: string;
  planId: string;
  paypalSubscriptionId?: string | null;
  paypalOrderId?: string | null;
}): Promise<MembershipSubscription> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const now = isoNow();
  const subscription: MembershipSubscription = {
    id: randomUUID(),
    userId: input.userId,
    planId: input.planId,
    status: "pending",
    paypalSubscriptionId: input.paypalSubscriptionId ?? null,
    paypalOrderId: input.paypalOrderId ?? null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute({
    sql: `INSERT INTO membership_subscriptions
      (id, user_id, plan_id, status, paypal_subscription_id, paypal_order_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      subscription.id,
      subscription.userId,
      subscription.planId,
      subscription.status,
      subscription.paypalSubscriptionId,
      subscription.paypalOrderId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      0,
      subscription.createdAt,
      subscription.updatedAt,
    ],
  });
  return subscription;
}

export async function updateSubscription(
  id: string,
  patch: Partial<Pick<MembershipSubscription, "status" | "paypalSubscriptionId" | "paypalOrderId" | "currentPeriodStart" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "planId">>,
) {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const fields: string[] = [];
  const args: Array<string | number | null> = [];
  const columnMap: Record<string, string> = {
    status: "status",
    paypalSubscriptionId: "paypal_subscription_id",
    paypalOrderId: "paypal_order_id",
    currentPeriodStart: "current_period_start",
    currentPeriodEnd: "current_period_end",
    cancelAtPeriodEnd: "cancel_at_period_end",
    planId: "plan_id",
  };
  for (const [key, column] of Object.entries(columnMap)) {
    const value = (patch as Record<string, string | boolean | null | undefined>)[key];
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      args.push(key === "cancelAtPeriodEnd" ? (value ? 1 : 0) : (value as string | null));
    }
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  args.push(isoNow());
  args.push(id);
  await db.execute({
    sql: `UPDATE membership_subscriptions SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function recordPayment(input: {
  userId: string;
  planId: string;
  subscriptionId?: string | null;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  raw?: unknown;
}): Promise<MembershipPayment> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const now = isoNow();
  const payment: MembershipPayment = {
    id: randomUUID(),
    userId: input.userId,
    subscriptionId: input.subscriptionId ?? null,
    planId: input.planId,
    paypalOrderId: input.paypalOrderId ?? null,
    paypalCaptureId: input.paypalCaptureId ?? null,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute({
    sql: `INSERT INTO membership_payments
      (id, user_id, subscription_id, plan_id, paypal_order_id, paypal_capture_id, amount_cents, currency, status, raw_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      payment.id,
      payment.userId,
      payment.subscriptionId,
      payment.planId,
      payment.paypalOrderId,
      payment.paypalCaptureId,
      payment.amountCents,
      payment.currency,
      payment.status,
      input.raw ? JSON.stringify(input.raw) : null,
      payment.createdAt,
      payment.updatedAt,
    ],
  });
  return payment;
}

export async function updatePaymentByOrderId(
  paypalOrderId: string,
  patch: Partial<Pick<MembershipPayment, "status" | "paypalCaptureId" | "subscriptionId">>,
  raw?: unknown,
) {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const fields: string[] = [];
  const args: Array<string | number | null> = [];
  if (patch.status !== undefined) {
    fields.push("status = ?");
    args.push(patch.status);
  }
  if (patch.paypalCaptureId !== undefined) {
    fields.push("paypal_capture_id = ?");
    args.push(patch.paypalCaptureId);
  }
  if (patch.subscriptionId !== undefined) {
    fields.push("subscription_id = ?");
    args.push(patch.subscriptionId);
  }
  if (raw !== undefined) {
    fields.push("raw_json = ?");
    args.push(JSON.stringify(raw));
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  args.push(isoNow());
  args.push(paypalOrderId);
  await db.execute({
    sql: `UPDATE membership_payments SET ${fields.join(", ")} WHERE paypal_order_id = ?`,
    args,
  });
}

export async function listUserPayments(userId: string, limit = 20): Promise<MembershipPayment[]> {
  await ensureMembershipTables();
  const db = getMembershipClient();
  const result = await db.execute({
    sql: "SELECT * FROM membership_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [userId, limit],
  });
  return result.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      userId: String(record.user_id),
      subscriptionId: (record.subscription_id as string | null) ?? null,
      planId: String(record.plan_id),
      paypalOrderId: (record.paypal_order_id as string | null) ?? null,
      paypalCaptureId: (record.paypal_capture_id as string | null) ?? null,
      amountCents: Number(record.amount_cents ?? 0),
      currency: String(record.currency ?? "USD"),
      status: record.status as PaymentStatus,
      createdAt: String(record.created_at),
      updatedAt: String(record.updated_at),
    };
  });
}
