-- CreateTable
CREATE TABLE "channel_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "icon" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "channel_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_templates_channel_id_idx" ON "channel_templates"("channel_id");

-- CreateIndex
CREATE INDEX "channel_templates_created_by_id_idx" ON "channel_templates"("created_by_id");

-- CreateIndex
CREATE INDEX "channel_templates_is_system_idx" ON "channel_templates"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "channel_templates_channel_id_name_key" ON "channel_templates"("channel_id", "name");

-- AddForeignKey
ALTER TABLE "channel_templates" ADD CONSTRAINT "channel_templates_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_templates" ADD CONSTRAINT "channel_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
