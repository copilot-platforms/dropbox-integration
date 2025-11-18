ALTER TABLE "channel_sync" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "file_folder_sync" ADD COLUMN "synced_from_assembly" boolean DEFAULT false NOT NULL;
ALTER TABLE "file_folder_sync" ADD COLUMN "synced_from_dropbox" boolean DEFAULT false NOT NULL;