## Step name
Implement rate limiting for vendor OTP and access flows

## Goal
Add server-side rate limiting to prevent brute force attacks on OTP verification and abuse of OTP email sending. This hardens the vendor access flow implemented in Step 4.

## Scope
- **Included**
  - Rate limiting for OTP send requests (per email + link + IP combination)
  - Rate limiting for OTP verification attempts (per challenge)
  - Rate limiting infrastructure (in-memory for MVP, Redis-ready interface)
  - Audit logging for rate limit violations (`access_denied` events)
  - UI feedback when rate limits are hit
- **Excluded**
  - Redis/distributed rate limiting (can be added later without code changes)
  - IP-based blocking at infrastructure level (WAF/CDN)
  - CAPTCHA integration
  - Account lockout (vendor has no account)

## Deliverables
### UI pages/components
- Update `/v/[token]` to display rate limit errors with retry-after countdown
- Toast/alert component for rate limit feedback

### API routes / server handlers
- `POST /api/vendor/[token]/otp/send`
  - Add rate limit check before OTP generation
  - Return `429 Too Many Requests` with `Retry-After` header when exceeded
  - Log `access_denied` audit event with reason `rate_limit_otp_send`
- `POST /api/vendor/[token]/otp/verify`
  - Add attempt counter check (already exists in `otp_challenges.attempts`)
  - Return `429` when max attempts exceeded
  - Log `access_denied` audit event with reason `rate_limit_otp_attempts`

### DB schema/migrations
- No new tables required
- `otp_challenges.attempts` field already exists from Step 4
- Optional: Add `rate_limit_events` table for persistent tracking (if moving beyond in-memory)

### Storage objects/buckets
- None

### Background jobs (if any)
- Optional: Cleanup job to expire old rate limit entries (if using DB-based storage)

## Key security properties enforced in this step
- **OTP abuse prevention**: Limit OTP sends to 3 per email+link per hour (TECH §5.2.1)
- **Brute force prevention**: Limit OTP attempts to 5 per challenge before invalidation
- **IP-based protection**: Track IP in rate limit key to prevent distributed attacks
- **Audit trail**: Log all rate limit violations for security monitoring

## Implementation notes
- **Rate limit storage**
  - Start with in-memory Map with TTL (suitable for single-instance deployment)
  - Design interface to allow Redis swap later: `RateLimiter.check(key, limit, windowMs)`
  - Key format: `otp_send:${shareLinkId}:${emailHash}:${ipHash}` or `otp_verify:${challengeId}`
- **Rate limit values**
  - OTP sends: 3 per hour per email+link+IP
  - OTP attempts: 5 per challenge (use existing `attempts` field)
- **Response format**
  - HTTP 429 with `Retry-After` header (seconds until reset)
  - JSON body: `{ error: "Rate limit exceeded", retryAfter: 3600, code: "RATE_LIMIT" }`
- **Sliding window vs fixed window**
  - Use sliding window for OTP sends (more fair)
  - Use fixed counter for OTP attempts (simpler, tied to challenge)

## Acceptance criteria (pass/fail)
- After 3 OTP sends for the same email+link within an hour, subsequent sends return 429
- After 5 failed OTP verification attempts, challenge is invalidated and returns 429
- Rate limit violations are logged as `access_denied` audit events
- UI displays user-friendly message with countdown when rate limited
- Rate limits reset correctly after window expires

## Validation checklist
### Manual test steps I can run locally
- Request OTP 4 times in quick succession → 4th request returns 429 with Retry-After
- Enter wrong OTP 6 times → 6th attempt returns 429, challenge invalidated
- Wait for rate limit window to expire → can request OTP again
- Check audit log for `access_denied` events with rate limit reason

### What to log/inspect to confirm correctness
- Console/logs: Rate limit check results (without exposing keys)
- DB: `audit_events` with `event_type = 'access_denied'` and rate limit metadata
- Response headers: `Retry-After` present on 429 responses

## Risks & mitigations
- **Memory growth**: Rate limit entries accumulate → implement TTL-based cleanup (every 5 minutes)
- **Distributed deployment**: In-memory rate limits don't share across instances → document Redis upgrade path
- **Legitimate users blocked**: Shared IP (office/VPN) could hit limits → use email+link+IP composite key, not just IP

## Ready for next step when…
- Rate limiting is active on OTP send and verify endpoints
- Audit log captures rate limit violations
- UI provides clear feedback when rate limited
- Existing vendor access flow continues to work within rate limits

## Files to create
- `webapp/src/lib/rate-limit/rate-limiter.ts` - Core rate limiting logic with TTL
- `webapp/src/lib/rate-limit/otp-rate-limit.ts` - OTP-specific rate limit configuration

## Files to modify
- `webapp/src/app/api/vendor/[token]/otp/send/route.ts` - Add rate limit check
- `webapp/src/app/api/vendor/[token]/otp/verify/route.ts` - Add attempt limit check
- `webapp/src/app/v/[token]/page.tsx` - Handle 429 responses with retry countdown
- `webapp/src/components/vendor/otp-form.tsx` - Display rate limit error state

## Environment variables
- `RATE_LIMIT_OTP_SEND_MAX` - Max OTP sends per window (default: 3)
- `RATE_LIMIT_OTP_SEND_WINDOW_MS` - Window duration in ms (default: 3600000 = 1 hour)
- `RATE_LIMIT_OTP_ATTEMPTS_MAX` - Max OTP verification attempts (default: 5)

## Dependencies
- No new npm packages required for in-memory implementation
- Optional: `ioredis` if upgrading to Redis-based rate limiting

