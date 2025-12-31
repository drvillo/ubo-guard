## Step name
Implement watermarking on vendor view/download + audit log extensions

## Goal
Add **session-specific watermarking** to vendor document views and downloads (PDF + images), and extend the audit log to record vendor document access events with **watermark reference IDs**—without the server ever handling plaintext.

## Scope
- **Included**
  - Watermark overlay on vendor document views (PDF viewer + image viewer)
  - Watermark generation on vendor document downloads (PDF + images)
  - Watermark reference ID generation and inclusion in audit events
  - Extend audit log to include `doc_viewed` and `doc_downloaded` events with watermark reference IDs
  - Update audit UI to display vendor events and watermark reference IDs
- **Excluded**
  - Advanced anti-screenshot measures (explicitly out of reach per PRD/TECH)
  - Multi-recipient vendor accounts or SSO
  - Delegate/owner audit UI polish beyond basic list

## Deliverables
### UI pages/components
- Vendor viewer components (extend existing from Step 4)
  - PDFs: `pdf.js` renderer with repeating overlay watermark layer for viewing
  - Images: canvas renderer with watermark overlay for viewing
- PDF/image download handlers with client-side watermark generation
- `/audit` (extend existing audit view)
  - Display vendor events (`doc_viewed`, `doc_downloaded`)
  - Display watermark reference IDs for vendor document access events

### API routes / server handlers
- `POST /api/audit` (already exists in Step 4, extend usage)
  - Called client-side for `doc_viewed` and `doc_downloaded` events
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
  - Apply as repeating pattern across document
- **PDF watermarking**
  - **View**: Use `pdf.js` renderer with CSS overlay layer (repeating watermark text)
  - **Download**: Use `pdf-lib` to generate new PDF with watermark text overlay on each page
- **Image watermarking**
  - **View**: Canvas-based renderer with watermark overlay drawn on canvas
  - **Download**: Generate new watermarked image via Canvas and trigger download
- **Audit event flow**
  - Client-side: Generate watermark reference ID when user initiates view/download
  - Client-side: Apply watermark to document (view or download)
  - Client-side: Call `POST /api/audit` with event type (`doc_viewed` or `doc_downloaded`), watermark reference ID, and metadata
  - Server-side: Validate vendor session, append audit event

## Acceptance criteria (pass/fail)
- Vendor can view documents with visible watermark overlay showing vendor label, timestamp, reference ID, and purpose notes
- Vendor can download documents with watermark embedded in the downloaded file
- Each view/download generates a unique watermark reference ID
- Audit log records `doc_viewed` and `doc_downloaded` events with watermark reference IDs
- Audit UI displays vendor document access events with watermark reference IDs

## Validation checklist
### Manual test steps I can run locally
- Complete vendor access flow from Step 4 (OTP + VS)
- View a PDF: verify watermark overlay is visible with correct text (vendor label, timestamp, reference ID)
- Download a PDF: verify downloaded file contains watermark on all pages
- View an image: verify watermark overlay is visible
- Download an image: verify downloaded file contains watermark
- Check audit log: verify `doc_viewed` and `doc_downloaded` events appear with watermark reference IDs
- Verify watermark reference IDs are unique per view/download

### What to log/inspect to confirm correctness
- DB: `audit_events` contains `doc_viewed` and `doc_downloaded` events with `watermark_reference_id` populated
- DB: `watermark_reference_id` values are unique UUIDs
- Client console: verify watermark reference IDs are generated and included in audit events
- Downloaded files: inspect PDF/image files to confirm watermark is embedded

## Risks & mitigations
- **Watermark readability**: tune opacity and spacing to balance visibility with document readability; provide a "preview watermark" UI if needed
- **Watermark removal**: acknowledge that determined users can remove watermarks; set expectations in product copy (per PRD §8.3)
- **Performance**: PDF watermarking with pdf-lib may be slow for large files; consider progress indicators
- **Browser compatibility**: Ensure Canvas and pdf.js work across target browsers

## Ready for next step when…
- Vendors can view and download both PDFs and images with visible watermarks, and the audit log correctly records all document access events with unique watermark reference IDs.

