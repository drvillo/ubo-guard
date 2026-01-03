-- Step 5: Add doc_viewed and doc_downloaded event types to AuditEventType enum
-- These events are used to track vendor document access with watermark reference IDs

ALTER TYPE "AuditEventType" ADD VALUE 'doc_viewed';
ALTER TYPE "AuditEventType" ADD VALUE 'doc_downloaded';

