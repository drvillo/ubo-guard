-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID', 'ProofOfAddress', 'SourceOfWealth');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('owner', 'delegate');

-- CreateEnum
CREATE TYPE "ShareRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('invite_created', 'invite_accepted', 'member_removed', 'share_request_created', 'share_request_approved', 'share_request_rejected', 'share_request_cancelled');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('owner', 'delegate', 'system');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaults" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfParams" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "ciphertextChecksum" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedBy" TEXT NOT NULL,
    "encryptedDekForOwner" TEXT NOT NULL,
    "dekNonce" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "permissionsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "permissionsJson" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "acceptedById" TEXT,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_requests" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "vendorLabel" TEXT NOT NULL,
    "purposeNotes" TEXT,
    "requestedDocTypes" "DocumentType"[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ShareRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "linkId" TEXT,
    "docType" "DocumentType",
    "watermarkReferenceId" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vaults_ownerId_key" ON "vaults"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_vaultId_docType_key" ON "documents"("vaultId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_vaultId_userId_key" ON "team_memberships"("vaultId", "userId");

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
