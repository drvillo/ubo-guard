## Step name
Implement watermarking on vendor view/download + audit log extensions

## Goal
Add **session-specific watermarking** to vendor document views and downloads (images only), and extend the audit log to record vendor document access events with **watermark reference IDs**—without the server ever handling plaintext.

## Scope
- **Included**
  - Watermark overlay on vendor image views (Canvas-based viewer)
  - Watermark generation on vendor image downloads
  - Watermark reference ID generation and inclusion in audit events
  - Extend audit log to include `doc_viewed` and `doc_downloaded` events with watermark reference IDs
  - Update audit UI to display vendor events and watermark reference IDs
- **Excluded**
  - PDF watermarking (images only in MVP)
  - Advanced anti-screenshot measures (explicitly out of reach per PRD/TECH)
  - Multi-recipient vendor accounts or SSO
  - Delegate/owner audit UI polish beyond basic list

## Deliverables
### UI pages/components
- Vendor viewer component (extend existing from Step 4)
  - Images: Canvas-based renderer with watermark overlay for viewing
- Image download handler with client-side watermark generation
- `/audit` (extend existing audit view)
  - Display vendor events (`doc_viewed`, `doc_downloaded`)
  - Display watermark reference IDs for vendor document access events

### API routes / server handlers
- `POST /api/vendor/[token]/audit`
  - Called client-side for `doc_viewed` and `doc_downloaded` events
  - Validates vendor session
  - Includes watermark reference ID in event data

### DB schema/migrations
- `audit_events` (schema already exists from Step 2, extend event types)
  - Add event types: `doc_viewed`, `doc_downloaded` to `AuditEventType` enum
  - `watermark_reference_id` field already exists (nullable, from Step 2 schema)
  - Ensure vendor actor type is supported (already exists from Step 4)

### Storage objects/buckets
- No new buckets
- Watermarked downloads are generated client-side and downloaded directly (not stored)

### Background jobs (if any)
- None required

## Key security properties enforced in this step
- **Watermark per recipient session** and tie to audit events (PRD §7.6, TECH §6/§7)
- **Unique watermark reference ID** generated per view/download for audit trail
- **Server stores ciphertext only**; watermarking happens client-side after decryption (TECH §3.2/§4.4/§5.4.3)
- **Audit log records all vendor document access** with watermark reference IDs

## Security model: Client-side decryption and watermarking

**Important**: The original document (plaintext) **will be available in the vendor browser** temporarily in memory. This is a necessary consequence of the trust minimization architecture:

1. **Server never sees plaintext**: Server only stores ciphertext and encrypted DEKs (TECH §3.2)
2. **Decryption happens client-side**: Vendor browser decrypts using LSK (derived from vendor secret) - see Step 4 flow
3. **Watermarking happens client-side**: After decryption, watermark is applied in the browser before display/download
4. **Plaintext exists in browser memory**: The decrypted image exists as a `Uint8Array`/`Blob` in JavaScript memory during the view/download operation

**Security implications:**
- ✅ Server maintains trust minimization (never sees plaintext)
- ✅ Watermarking discourages casual reuse and provides audit trail
- ⚠️ Determined users can screenshot or extract plaintext from browser memory (acknowledged in PRD §8.3)
- ⚠️ Watermark can be removed from downloaded images with image editing tools

**This is the intended MVP security posture**: Watermarking provides accountability and discourages misuse, but cannot prevent determined extraction. Product copy should set appropriate expectations (per PRD §8.3).

## Implementation notes
- **Watermark reference ID**
  - Generate UUID v4 per view/download session
  - Include in watermark text rendered on document
  - Store in `audit_events.watermark_reference_id` for `doc_viewed` and `doc_downloaded` events
- **Watermark text format**
  - Multi-line overlay:
    ```
    Confidential - [vendor_label]
    Access Date: [timestamp]
    Reference: [watermark_reference_id]
    [purpose_notes if present]
    ```
  - Apply as repeating diagonal pattern across image
- **Image watermarking (Canvas-based, client-side)**
  - **Flow**: 
    1. Vendor browser fetches ciphertext from server (signed URL)
    2. Vendor browser decrypts ciphertext → plaintext image in memory (`Uint8Array`)
    3. Vendor browser loads plaintext into Canvas
    4. Vendor browser draws watermark overlay on Canvas
    5. For view: Display watermarked Canvas in modal
    6. For download: Export watermarked Canvas as Blob and trigger download
  - **View**: Render image to Canvas, draw semi-transparent watermark text overlay at 45° angle, display in modal/viewer
  - **Download**: Generate new watermarked image via Canvas (`toBlob`) and trigger download
  - Use ~30% opacity white/gray text with dark stroke for visibility across light/dark backgrounds
  - **Note**: Original plaintext exists in browser memory during this process; watermarking does not prevent access to unwatermarked data
- **Audit event flow**
  - Client-side: Generate watermark reference ID when user initiates view/download
  - Client-side: Decrypt document (plaintext now in browser memory)
  - Client-side: Apply watermark to image (view or download)
  - Client-side: Call `POST /api/vendor/[token]/audit` with event type (`doc_viewed` or `doc_downloaded`), docType, watermark reference ID
  - Server-side: Validate vendor session, append audit event (server never sees plaintext)

## Acceptance criteria (pass/fail)
- Vendor can view images with visible watermark overlay showing vendor label, timestamp, reference ID, and purpose notes
- Vendor can download images with watermark embedded in the downloaded file
- Each view/download generates a unique watermark reference ID
- Audit log records `doc_viewed` and `doc_downloaded` events with watermark reference IDs
- Audit UI displays vendor document access events with watermark reference IDs

## Validation checklist
### Manual test steps I can run locally
- Complete vendor access flow from Step 4 (OTP + VS)
- View an image: verify watermark overlay is visible with correct text (vendor label, timestamp, reference ID)
- Download an image: verify downloaded file contains watermark
- Check audit log: verify `doc_viewed` and `doc_downloaded` events appear with watermark reference IDs
- Verify watermark reference IDs are unique per view/download

### What to log/inspect to confirm correctness
- DB: `audit_events` contains `doc_viewed` and `doc_downloaded` events with `watermark_reference_id` populated
- DB: `watermark_reference_id` values are unique UUIDs
- Client console: verify watermark reference IDs are generated and included in audit events
- Downloaded files: inspect image files to confirm watermark is embedded

## Risks & mitigations
- **Watermark readability**: tune opacity and spacing to balance visibility with document readability
- **Watermark removal**: acknowledge that determined users can remove watermarks; set expectations in product copy (per PRD §8.3)
- **Browser compatibility**: Canvas API is well-supported across modern browsers

## Ready for next step when…
- Vendors can view and download images with visible watermarks, and the audit log correctly records all document access events with unique watermark reference IDs.

## Implementation Plan

### Critical Incompatibilities Identified

1. **Missing Event Types in Schema**
   - **Current**: `AuditEventType` enum lacks `doc_viewed` and `doc_downloaded`
   - **Required**: Add both event types for vendor document access logging
   - **Impact**: Prisma migration required

2. **No Vendor Audit API Endpoint**
   - **Current**: `/api/audit` only supports GET for authenticated users (owners/delegates)
   - **Required**: Vendors need to log events client-side after decryption/watermarking
   - **Impact**: Create new `POST /api/vendor/[token]/audit` route

3. **Document List Component Lacks Watermarking**
   - **Current**: `DocumentList` component downloads and decrypts without watermarking
   - **Required**: Add view capability, watermark generation, and audit logging
   - **Impact**: Significant component enhancement

### Design Decisions

1. **Images Only (Confirmed)**
   - No PDF libraries needed (pdfjs-dist, pdf-lib)
   - Canvas API only for watermarking
   - Simplifies implementation significantly

2. **Viewer Architecture**
   - Create unified `ImageViewer` component with modal display
   - Reuse watermark logic between view and download

3. **Watermark Reference ID Flow**
   - Generate UUID v4 client-side when user initiates view/download
   - Pass to audit API after watermark applied
   - Store in `audit_events.watermark_reference_id`

4. **File Type Handling**
   - Detect image types by filename extension (.jpg, .jpeg, .png, .webp, .gif)
   - Non-image files: show warning, allow download without watermark (or block)

### Implementation Phases

#### Phase 1: Schema Migration
**Files to modify:**
- `webapp/prisma/schema.prisma` - Add `doc_viewed`, `doc_downloaded` to `AuditEventType` enum

**Migration:**
```sql
ALTER TYPE "AuditEventType" ADD VALUE 'doc_viewed';
ALTER TYPE "AuditEventType" ADD VALUE 'doc_downloaded';
```

#### Phase 2: Vendor Audit API
**Files to create:**
- `webapp/src/app/api/vendor/[token]/audit/route.ts`

**Endpoint contract:**
```typescript
POST /api/vendor/[token]/audit
Body: {
  eventType: 'doc_viewed' | 'doc_downloaded',
  docType: 'ID' | 'ProofOfAddress' | 'SourceOfWealth',
  watermarkReferenceId: string // UUID v4
}
Response: { success: true }
```

**Validation:**
- Require valid vendor session (reuse `validateVendorSession`)
- Validate link status (not expired/revoked)
- Validate watermark reference ID is UUID format
- Call `logAuditEvent` with vendor actor type

#### Phase 3: Watermark Utilities
**Files to create:**
- `webapp/src/lib/watermark/watermark.ts`

**Functions:**
```typescript
// Generate UUID v4 for watermark reference
function generateWatermarkReferenceId(): string

// Generate watermark text lines
function generateWatermarkText(params: {
  vendorLabel: string
  timestamp: Date
  referenceId: string
  purposeNotes?: string | null
}): string[]

// Apply watermark to image and return watermarked blob
async function applyImageWatermark(
  imageBlob: Blob,
  watermarkText: string[]
): Promise<Blob>

// Check if filename is a supported image type
function isSupportedImageType(filename: string): boolean
```

#### Phase 4: Image Viewer Component
**Files to create:**
- `webapp/src/components/vendor/image-viewer.tsx`

**Features:**
- Modal overlay with close button
- Canvas-based image display with watermark
- Responsive sizing
- Loading state

#### Phase 5: Update Document List
**Files to modify:**
- `webapp/src/components/vendor/document-list.tsx`

**Changes:**
1. Add "View" button alongside "Download"
2. Integrate `ImageViewer` component
3. Apply watermark on download
4. Call audit API after view/download
5. Handle non-image files (warning or block)

#### Phase 6: Update Audit UI
**Files to modify:**
- `webapp/src/components/audit/audit-log.tsx`
- `webapp/src/app/audit/page.tsx`

**Changes:**
1. Add `watermarkReferenceId` to `AuditEvent` interface
2. Display watermark reference ID for `doc_viewed` and `doc_downloaded` events
3. Format vendor events distinctly (e.g., different icon/color)

### Files Summary

**Create:**
```
webapp/prisma/migrations/YYYYMMDD_step_5_doc_events/migration.sql
webapp/src/app/api/vendor/[token]/audit/route.ts
webapp/src/lib/watermark/watermark.ts
webapp/src/components/vendor/image-viewer.tsx
webapp/test/api/vendor/audit.test.ts
webapp/test/lib/watermark/watermark.test.ts
webapp/test/manual/STEP-5-CONFIGURATION-AND-TESTING.md
```

**Modify:**
```
webapp/prisma/schema.prisma
webapp/src/components/vendor/document-list.tsx
webapp/src/components/audit/audit-log.tsx
webapp/src/app/audit/page.tsx
```

### DRY Compliance

**Reuse existing utilities:**
| Utility | Location | Usage |
|---------|----------|-------|
| `logAuditEvent` | `src/lib/audit/audit-log.ts` | Called by vendor audit API |
| `validateVendorSession` | `src/lib/auth/vendor-session.ts` | Auth for vendor audit API |
| `hashToken` | `src/lib/crypto/token-hash.ts` | Token lookup |
| `decryptDocumentForVendor` | `src/lib/crypto/client-crypto.ts` | Already in use |

**New shared utilities:**
| Utility | Consumers |
|---------|-----------|
| `generateWatermarkReferenceId` | DocumentList (view + download handlers) |
| `generateWatermarkText` | ImageViewer, download handler |
| `applyImageWatermark` | ImageViewer, download handler |

### Testing Plan

**Unit Tests:**
| Test File | Coverage |
|-----------|----------|
| `test/lib/watermark/watermark.test.ts` | Reference ID generation, text formatting, image type detection |
| `test/api/vendor/audit.test.ts` | Vendor audit API validation, session checks |

**Manual Tests (STEP-5-CONFIGURATION-AND-TESTING.md):**
1. Complete vendor access flow (OTP + VS)
2. View image → verify watermark visible with correct text
3. Download image → verify watermark in downloaded file
4. Check `/audit` → verify events with watermark reference IDs
5. Verify reference IDs are unique per view/download
6. Test non-image file handling

### Implementation Tasks

1. **Schema Migration**: Add `doc_viewed`, `doc_downloaded` to `AuditEventType` enum
2. **Vendor Audit API**: Create `POST /api/vendor/[token]/audit` route with session validation
3. **Watermark Utilities**: Implement reference ID generation, text formatting, Canvas watermarking
4. **Image Viewer**: Create modal component with Canvas-based watermarked display
5. **Document List Update**: Add View button, watermark on download, audit logging
6. **Audit UI Update**: Display watermark reference IDs for document access events
7. **Unit Tests**: Test watermark utilities and vendor audit API
8. **Manual Test Guide**: Create STEP-5 testing documentation

