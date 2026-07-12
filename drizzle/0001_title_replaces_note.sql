ALTER TABLE "transactions" ADD COLUMN "title" text;
--> statement-breakpoint
UPDATE "transactions" SET "title" = COALESCE(NULLIF(TRIM("note"), ''), 'Payment');
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "title" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "note";
