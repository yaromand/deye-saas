import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One user = one tenant on MVP (tenant_id === user.id). */

export const userRoleEnum = pgEnum("user_role", ["admin", "client"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "blocked",
  "pending",
]);
export const vendorEnum = pgEnum("vendor", ["solarman", "deye", "felicity"]);
export const connectionStatusEnum = pgEnum("connection_status", [
  "active",
  "error",
  "disabled",
]);
export const inverterStatusEnum = pgEnum("inverter_status", [
  "online",
  "offline",
  "unknown",
  "error",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "offline",
  "power_low",
  "power_high",
  "energy_threshold",
  "custom",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);
export const telegramBotStatusEnum = pgEnum("telegram_bot_status", [
  "active",
  "inactive",
  "error",
]);
export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "queued",
  "sending",
  "done",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("client"),
    status: userStatusEnum("status").notNull().default("active"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const vendorAccounts = pgTable(
  "vendor_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendor: vendorEnum("vendor").notNull(),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    label: text("label"),
    status: connectionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vendor_accounts_tenant_idx").on(t.tenantId)],
);

export const inverters = pgTable(
  "inverters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendorAccountId: uuid("vendor_account_id")
      .notNull()
      .references(() => vendorAccounts.id, { onDelete: "cascade" }),
    externalDeviceId: text("external_device_id").notNull(),
    name: text("name").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    status: inverterStatusEnum("status").notNull().default("unknown"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inverters_tenant_idx").on(t.tenantId),
    uniqueIndex("inverters_vendor_external_uidx").on(
      t.vendorAccountId,
      t.externalDeviceId,
    ),
  ],
);

export const telemetryPoints = pgTable(
  "telemetry_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inverterId: uuid("inverter_id")
      .notNull()
      .references(() => inverters.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    metrics: jsonb("metrics")
      .$type<{
        powerW?: number;
        energyKwh?: number;
        soc?: number;
        status?: string;
        [key: string]: unknown;
      }>()
      .notNull()
      .default({}),
    powerW: real("power_w"),
    energyKwh: real("energy_kwh"),
    soc: real("soc"),
  },
  (t) => [index("telemetry_points_inverter_ts_idx").on(t.inverterId, t.ts)],
);

export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inverterId: uuid("inverter_id").references(() => inverters.id, {
      onDelete: "cascade",
    }),
    type: alertTypeEnum("type").notNull(),
    threshold: real("threshold"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("alert_rules_tenant_idx").on(t.tenantId)],
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    inverterId: uuid("inverter_id")
      .notNull()
      .references(() => inverters.id, { onDelete: "cascade" }),
    firedAt: timestamp("fired_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .notNull()
      .default("pending"),
  },
  (t) => [index("alert_events_rule_idx").on(t.ruleId)],
);

export const telegramBots = pgTable(
  "telegram_bots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    botTokenEncrypted: text("bot_token_encrypted").notNull(),
    botUsername: text("bot_username"),
    webhookSecret: text("webhook_secret"),
    status: telegramBotStatusEnum("status").notNull().default("inactive"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("telegram_bots_tenant_uidx").on(t.tenantId)],
);

export const telegramSubscribers = pgTable(
  "telegram_subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    botId: uuid("bot_id")
      .notNull()
      .references(() => telegramBots.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("telegram_subscribers_bot_chat_uidx").on(t.botId, t.chatId),
  ],
);

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: broadcastStatusEnum("status").notNull().default("draft"),
    sentCount: integer("sent_count").notNull().default(0),
  },
  (t) => [index("broadcasts_tenant_idx").on(t.tenantId)],
);

export const jobsAudit = pgTable("jobs_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  ref: text("ref"),
  error: text("error"),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Inverter = typeof inverters.$inferSelect;
export type TelemetryPoint = typeof telemetryPoints.$inferSelect;
