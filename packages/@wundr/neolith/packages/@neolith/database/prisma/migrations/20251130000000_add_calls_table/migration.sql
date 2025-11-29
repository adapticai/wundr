-- CreateEnum for call types
DO $$ BEGIN
 CREATE TYPE "CallType" AS ENUM ('audio', 'video');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for call status
DO $$ BEGIN
 CREATE TYPE "CallStatus" AS ENUM ('pending', 'ringing', 'active', 'ended', 'declined', 'missed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: calls
CREATE TABLE IF NOT EXISTS "calls" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "type" "CallType" NOT NULL DEFAULT 'audio',
    "status" "CallStatus" NOT NULL DEFAULT 'pending',
    "room_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: call_participants
CREATE TABLE IF NOT EXISTS "call_participants" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_audio_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_video_enabled" BOOLEAN NOT NULL DEFAULT false,
    "duration_seconds" INTEGER,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_channel_id_idx" ON "calls"("channel_id");
CREATE INDEX "calls_status_idx" ON "calls"("status");
CREATE INDEX "calls_created_by_id_idx" ON "calls"("created_by_id");
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");
CREATE UNIQUE INDEX "calls_channel_id_status_active_unique" ON "calls"("channel_id", "status") WHERE "status" IN ('pending', 'ringing', 'active');

CREATE INDEX "call_participants_call_id_idx" ON "call_participants"("call_id");
CREATE INDEX "call_participants_user_id_idx" ON "call_participants"("user_id");
CREATE INDEX "call_participants_joined_at_idx" ON "call_participants"("joined_at");
CREATE UNIQUE INDEX "call_participants_call_id_user_id_unique" ON "call_participants"("call_id", "user_id") WHERE "left_at" IS NULL;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
