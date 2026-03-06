CREATE TABLE "incorrect_path_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar(32) NOT NULL,
	"file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_move_complete" boolean DEFAULT false NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
