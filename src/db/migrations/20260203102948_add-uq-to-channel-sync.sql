DROP INDEX IF EXISTS "uq_channel_sync_channel_id_dbx_root_path";

CREATE UNIQUE INDEX "uq_channel_sync__channel_id_dbx_root_path"
ON "public"."channel_sync" ("assembly_channel_id", "dbx_root_path")
WHERE "deleted_at" IS NULL;
