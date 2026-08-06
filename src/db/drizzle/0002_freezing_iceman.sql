ALTER TABLE "questions" DROP COLUMN "image_width";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "image_placement" text DEFAULT 'below' NOT NULL;