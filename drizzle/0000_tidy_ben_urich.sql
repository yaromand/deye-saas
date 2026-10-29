CREATE TYPE "public"."alert_type" AS ENUM('offline', 'power_low', 'power_high', 'energy_threshold', 'custom');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'queued', 'sending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'error', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."inverter_status" AS ENUM('online', 'offline', 'unknown', 'error');--> statement-breakpoint
CREATE TYPE "public"."telegram_bot_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked', 'pending');--> statement-breakpoint
CREATE TYPE "public"."vendor" AS ENUM('solarman', 'deye', 'felicity');--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"inverter_id" uuid NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"inverter_id" uuid,
	"type" "alert_type" NOT NULL,
	"threshold" real,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inverters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor_account_id" uuid NOT NULL,
	"external_device_id" text NOT NULL,
	"name" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"last_seen_at" timestamp with time zone,
	"status" "inverter_status" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"ref" text,
	"error" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bot_token_encrypted" text NOT NULL,
	"bot_username" text,
	"webhook_secret" text,
	"status" "telegram_bot_status" DEFAULT 'inactive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inverter_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"power_w" real,
	"energy_kwh" real,
	"soc" real
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor" "vendor" NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"label" text,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_vendor_account_id_vendor_accounts_id_fk" FOREIGN KEY ("vendor_account_id") REFERENCES "public"."vendor_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_subscribers" ADD CONSTRAINT "telegram_subscribers_bot_id_telegram_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."telegram_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_points" ADD CONSTRAINT "telemetry_points_inverter_id_inverters_id_fk" FOREIGN KEY ("inverter_id") REFERENCES "public"."inverters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_accounts" ADD CONSTRAINT "vendor_accounts_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_events_rule_idx" ON "alert_events" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_rules_tenant_idx" ON "alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "broadcasts_tenant_idx" ON "broadcasts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inverters_tenant_idx" ON "inverters" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inverters_vendor_external_uidx" ON "inverters" USING btree ("vendor_account_id","external_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_bots_tenant_uidx" ON "telegram_bots" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_subscribers_bot_chat_uidx" ON "telegram_subscribers" USING btree ("bot_id","chat_id");--> statement-breakpoint
CREATE INDEX "telemetry_points_inverter_ts_idx" ON "telemetry_points" USING btree ("inverter_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendor_accounts_tenant_idx" ON "vendor_accounts" USING btree ("tenant_id");