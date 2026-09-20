CREATE TABLE "app_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_state" ("id", "setup_completed")
SELECT 1, true
WHERE EXISTS (SELECT 1 FROM "transactions")
   OR EXISTS (SELECT 1 FROM "snapshots")
   OR EXISTS (SELECT 1 FROM "budgets")
   OR EXISTS (SELECT 1 FROM "accounts" WHERE "opening_balance" <> 0)
ON CONFLICT ("id") DO NOTHING;
