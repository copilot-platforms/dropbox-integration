CREATE TABLE "dropbox_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar(32) NOT NULL,
	"account_id" varchar(100),
	"refresh_token" varchar(255),
	"status" boolean DEFAULT false NOT NULL,
	"initiated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_dropbox_connections_portal_id" ON "dropbox_connections" USING btree ("portal_id");