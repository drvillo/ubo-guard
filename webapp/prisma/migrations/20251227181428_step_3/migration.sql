-- CreateEnum
CREATE TYPE "ShareLinkStatus" AS ENUM ('pending', 'approved', 'revoked');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'link_created';
ALTER TYPE "AuditEventType" ADD VALUE 'link_revoked';

-- AlterTable
ALTER TABLE "share_requests" ADD COLUMN     "vendorEmail" TEXT;

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "shareRequestId" TEXT,
    "status" "ShareLinkStatus" NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "vendorLabel" TEXT NOT NULL,
    "vendorEmail" TEXT NOT NULL,
    "purposeNotes" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "tokenHash" TEXT NOT NULL,
    "encryptedLskForVendor" TEXT,
    "lskSalt" TEXT,
    "lskNonce" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_link_documents" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "encryptedDekForLink" TEXT NOT NULL,
    "dekForLinkNonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_link_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_shareRequestId_key" ON "share_links"("shareRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "share_link_documents_shareLinkId_documentId_key" ON "share_link_documents"("shareLinkId", "documentId");

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_shareRequestId_fkey" FOREIGN KEY ("shareRequestId") REFERENCES "share_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_link_documents" ADD CONSTRAINT "share_link_documents_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_link_documents" ADD CONSTRAINT "share_link_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
