CREATE TYPE "public"."recurrence" AS ENUM('monthly', 'weekly', 'yearly');
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"month" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" "txn_type" NOT NULL,
	"amount" integer NOT NULL,
	"category_id" integer,
	"method_id" integer,
	"from_account_id" integer,
	"to_account_id" integer,
	"income_source" "income_source",
	"recurrence" "recurrence" DEFAULT 'monthly' NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"month_of_year" integer,
	"last_logged_date" date,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_method_id_payment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_category_month" ON "budgets" USING btree ("category_id","month");
--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_overall_month" ON "budgets" USING btree ("month") WHERE "budgets"."category_id" is null;
