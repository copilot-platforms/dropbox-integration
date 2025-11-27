CREATE TYPE "public"."assembly_webhook_events_enum" AS ENUM('file.created', 'file.updated', 'file.deleted', 'folder.created', 'folder.updated', 'folder.deleted');
CREATE TABLE "assembly_webhook_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar(32) NOT NULL,
	"action" "assembly_webhook_events_enum" NOT NULL,
	"assembly_channel_id" varchar(255) NOT NULL,
	"file_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_all_columns_combined" ON "assembly_webhook_records" USING btree ("portal_id","assembly_channel_id","file_id","triggered_at","action");