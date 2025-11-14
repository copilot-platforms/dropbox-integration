CREATE TYPE "public"."object_types" AS ENUM('file', 'folder');
CREATE TABLE "channel_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar(32) NOT NULL,
	"dbx_account_id" varchar(100) NOT NULL,
	"assembly_channel_id" varchar(255) NOT NULL,
	"dbx_root_path" varchar NOT NULL,
	"dbx_cursor" varchar,
	"status" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "file_folder_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar(32) NOT NULL,
	"channel_sync_id" uuid NOT NULL,
	"item_path" varchar,
	"object" "object_types" DEFAULT 'file' NOT NULL,
	"content_hash" varchar,
	"dbx_file_id" varchar,
	"assembly_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "file_folder_sync" ADD CONSTRAINT "file_folder_sync_channel_sync_id_channel_sync_id_fk" FOREIGN KEY ("channel_sync_id") REFERENCES "public"."channel_sync"("id") ON DELETE cascade ON UPDATE cascade;