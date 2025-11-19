ALTER TABLE "channel_sync" ADD COLUMN "deleted_at" timestamp with time zone;
ALTER TABLE "file_folder_sync" ADD COLUMN "deleted_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "idx_channel_sync_portal_id_dbxAccount_id_deleted_at" ON "channel_sync" USING btree ("portal_id","dbx_account_id","deleted_at" NULLS FIRST);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_channel_sync_channel_id_dbx_root_path" ON "channel_sync" USING btree ("assembly_channel_id","dbx_root_path");
Create UNIQUE INDEX IF NOT EXISTS "uq_dropbox_connections_portal_id" ON "dropbox_connections" USING btree ("portal_id");
