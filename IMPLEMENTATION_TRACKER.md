# The Cake Bake — Implementation Tracker

This tracker follows `IMPLEMENTATION_PLAN.md` and records what is done, in progress, blocked, and remaining.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked or needs owner decision

## Current execution focus

- `[x]` Sprint 1 — Must-fix before launch
- `[x]` Sprint 2 — Security hardening
- `[~]` Sprint 3 — Scale and operations
- `[ ]` Sprint 4 — Ecommerce polish

## Sprint 1 — Must-fix before launch

- `[x]` 1. Atomic stock reservation and strict stock decrement failure handling
- `[x]` 2. Checkout idempotency for authenticated and guest checkout
- `[x]` 3. Payment confirmation and webhook idempotency
- `[x]` 4. Transaction-safe coupon usage
- `[x]` 5. Transaction-safe loyalty redemption and restoration
- `[x]` 6. Guest order tracking without login
- `[x]` 7. Side-effect-free checkout validation

### Sprint 1 acceptance tracker

- `[x]` Two customers cannot buy the final same item at the same time
- `[x]` Paid order never exists without inventory reserved or confirmed
- `[x]` Expired or failed online payments release stock
- `[x]` COD order creation fails cleanly if stock is unavailable
- `[x]` Double-clicking place order creates one order only
- `[x]` Browser retry returns the same order/payment result
- `[x]` Duplicate Razorpay orders are not created for the same checkout attempt
- `[x]` Razorpay webhook retry is harmless
- `[x]` Client payment verify retry is harmless
- `[x]` Coupon global/per-user usage limits cannot be exceeded by concurrency
- `[x]` Loyalty balance cannot go negative
- `[x]` Guest can track an order without account login and without exposing another order
- `[x]` Checkout validation does not create address records

## Sprint 2 — Security hardening

- `[x]` Move refresh tokens to HttpOnly secure cookies with rotation and reuse detection
- `[x]` Hash refresh tokens before storage
- `[x]` Separate customer/admin refresh handling
- `[x]` Add admin login rate limits and suspicious login logging
- `[x]` Add audit logs for sensitive admin actions
- `[x]` Verify WhatsApp/Meta webhook signatures
- `[x]` Harden public health endpoint output
- `[x]` Add frontend production security headers and CSP

## Sprint 3 — Scale and operations

- `[x]` Redis-backed production rate limiting
- `[x]` Shared Redis cache for public catalog data
- `[x]` Queue-based background jobs
- `[ ]` Payment reconciliation job
- `[ ]` Stock reservation expiry job
- `[ ]` Database index optimization
- `[ ]` Monitoring and alerting for critical incidents

## Sprint 4 — Ecommerce polish

- `[ ]` COD fraud and abuse controls
- `[ ]` Cancellation and refund workflow
- `[ ]` Product search and catalog UX improvements
- `[ ]` CDN/image optimization
- `[ ]` Admin operational dashboard
- `[ ]` Backend automated tests
- `[ ]` Frontend automated tests
- `[ ]` Release readiness checklist

## Change log

| Date | Area | Status | Notes |
| --- | --- | --- | --- |
| 2026-05-18 | Tracker | Completed | Created root tracker and set Sprint 1 as active. |
| 2026-05-18 | Sprint 1.1 Inventory reservation | Completed | Added reservation-by-decrement for authenticated COD and online checkout, confirmed reservations on payment capture, and released reservations on failed, expired, or cancelled orders. |
| 2026-05-18 | Sprint 1.2 Checkout idempotency | Completed | Added backend idempotency handling for authenticated and guest checkout and frontend checkout idempotency keys for guest, COD, and Razorpay order creation. |
| 2026-05-18 | Sprint 1.3 Payment lifecycle hardening | Completed | Added timing-safe Razorpay signature verification, idempotent client payment verification, webhook event idempotency, guarded captured/failed payment state transitions, and captured-payment reconciliation from the expiry job. |
| 2026-05-18 | Sprint 1.4 Transaction-safe coupon usage | Completed | Added atomic coupon usage consumption with global limit guards, per-customer usage counters, idempotent order usage records, online checkout coupon reservation, and coupon release for unpaid online cancellations or expiry. |
| 2026-05-18 | Sprint 1.5 Transaction-safe loyalty | Completed | Added shared transaction-safe loyalty service for conditional redemption, idempotent restore/reapply/earn ledger events, late-capture reapply guards, and admin adjustment balance guards. |
| 2026-05-18 | Sprint 1.6 Guest order tracking | Completed | Added signed guest tracking tokens, hashed token storage, public rate-limited token validation, guest confirmation/tracking links, limited guest order payloads, and targeted backend token tests. |
| 2026-05-18 | Sprint 2.1 Refresh token hardening | Completed | Moved refresh tokens to scoped HttpOnly cookies, stored only token hashes, added atomic rotation with reuse invalidation, separated admin/customer refresh sessions, shortened the default access-token lifetime, and removed refresh-token localStorage usage. |
| 2026-05-18 | Sprint 2.2 Admin login security | Completed | Added admin-scope login rate limiting, durable security events for admin login success/failure/rate-limit blocks, sanitized suspicious login logging, and targeted security helper tests. |
| 2026-05-18 | Sprint 2.3 Admin action audit logs | Completed | Added durable admin audit logs, audit middleware for sensitive admin mutations, sanitized payload capture with price/stock field extraction, audit-log retrieval endpoint, and targeted audit helper tests. |
| 2026-05-18 | Sprint 2.4 WhatsApp webhook signatures | Completed | Added raw-body Meta webhook verification using X-Hub-Signature-256 and the Meta app secret, rejected unsigned/spoofed requests before JSON parsing, added a dedicated WhatsApp webhook rate limiter, and covered signature edge cases with targeted tests. |
| 2026-05-18 | Sprint 2.5 Health endpoint hardening | Completed | Replaced the public health response with minimal liveness output, moved database/provider readiness checks behind admin auth or an internal health token, removed public runtime/config exposure, exempted exact health probe routes from the general API limiter, and added targeted health tests. |
| 2026-05-18 | Sprint 2.6 Frontend security headers | Completed | Added Next production security headers with enforceable CSP, Razorpay-aware script/connect/frame allowances, production HSTS, safe browser hardening headers, development HMR allowances, and targeted CSP/header tests. |
| 2026-05-18 | Sprint 3.1 Redis-backed rate limiting | Completed | Added Redis client configuration, production REDIS_URL validation, atomic Redis-backed express-rate-limit stores with per-limiter namespaces, stricter high-risk auth/coupon limits, Redis startup/shutdown handling, targeted Redis store tests, and a clean production dependency audit. |
| 2026-05-18 | Sprint 3.2 Shared Redis catalog cache | Completed | Reworked cache utility to support shared Redis caching with local dev fallback and fail-open reads, added request coalescing for cache misses, cached categories, product/category listings, product details, featured/bestseller/trending products, banners, add-ons, and delivery data, and invalidated catalog cache on admin product/category/banner/add-on/delivery mutations. |
| 2026-05-18 | Sprint 3.3 Queue-based background jobs | Completed | Added BullMQ/Redis queue infrastructure with inline dev fallback, queued email/WhatsApp notification dispatch with deterministic job IDs and idempotent notification logs, started notification workers on server boot, and added targeted queue tests plus backend regression validation. |
