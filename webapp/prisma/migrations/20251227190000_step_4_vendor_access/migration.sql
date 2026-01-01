-- AlterEnum
-- Add vendor event types to AuditEventType
ALTER TYPE "AuditEventType" ADD VALUE 'otp_sent';
ALTER TYPE "AuditEventType" ADD VALUE 'otp_verified';
ALTER TYPE "AuditEventType" ADD VALUE 'access_denied';

-- AlterEnum
-- Add vendor actor type to AuditActorType
ALTER TYPE "AuditActorType" ADD VALUE 'vendor';

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "share_link_id" TEXT NOT NULL,
    "vendor_email_hash" TEXT NOT NULL,
    "email_salt" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "otp_salt" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_challenges_share_link_id_vendor_email_hash_idx" ON "otp_challenges"("share_link_id", "vendor_email_hash");

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

