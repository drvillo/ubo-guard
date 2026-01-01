-- Remove FK constraint from audit_events.actorId
-- The actorId field is now a polymorphic identifier:
--   - For owner/delegate: contains UserProfile.id
--   - For vendor: contains vendorEmailHash (pseudonymized)
--   - For system: null

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_actorId_fkey";

-- AlterTable - make actorId nullable for system events
ALTER TABLE "audit_events" ALTER COLUMN "actorId" DROP NOT NULL;

