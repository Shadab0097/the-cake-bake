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
- `[x]` Sprint 3 — Scale and operations
- `[x]` Sprint 4 — Ecommerce polish

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
- `[x]` Payment reconciliation job
- `[x]` Stock reservation expiry job
- `[x]` Database index optimization
- `[x]` Monitoring and alerting for critical incidents

## Sprint 4 — Ecommerce polish

- `[x]` COD fraud and abuse controls
- `[x]` Cancellation and refund workflow
- `[x]` Product search and catalog UX improvements
- `[x]` CDN/image optimization
- `[x]` Admin operational dashboard
- `[x]` Backend automated tests
- `[x]` Frontend automated tests
- `[x]` Release readiness checklist

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
| 2026-05-19 | Sprint 3.4 Payment reconciliation job | Completed | Added a distributed-lock Razorpay reconciliation scheduler that scans older provider payment records, repairs captured-but-local-pending payments through the transaction-safe finalizer, records authorized/failed provider states idempotently, isolates provider API failures per candidate, and added targeted reconciliation tests. |
| 2026-05-19 | Sprint 3.5 Stock reservation expiry job | Completed | Added a distributed-lock reservation expiry scheduler using InventoryReservation.expiresAt as the scan source, re-checking payment/provider state before release, confirming reservations for paid/captured orders, expiring unpaid online reservations exactly once, and adding targeted expiry safety tests. |
| 2026-05-19 | Sprint 3.6 Database index optimization | Completed | Added order status/paymentStatus plus createdAt compound indexes, normalized Razorpay payment lookup indexes to partial provider-ID indexes, added payment status/createdAt reconciliation scan coverage, removed the duplicate Razorpay order index warning, and added schema index regression tests for required large-traffic query paths. |
| 2026-05-19 | Sprint 3.7 Monitoring and alerting | Completed | Added persistent operational alerts with dedupe keys, redacted metadata, optional webhook notification with cooldown, admin alert listing, private readiness monitoring status, API 5xx alert hooks, critical payment/order mismatch alerts, and targeted alerting tests. |
| 2026-05-19 | Sprint 4.1 COD fraud and abuse controls | Completed | Added shared COD risk assessment for authenticated and guest checkout, conservative velocity checks for phone/IP/address cancellation abuse, high-value COD controls, disposable email and fake-phone detection, account-level COD disable support, persisted COD risk snapshots on orders, operational alerts for suspicious COD attempts, and targeted COD abuse tests. |
| 2026-05-19 | Sprint 4.2 Cancellation and refund workflow | Completed | Added cancellation policy evaluation with customer cutoff rules, refund state fields on orders/payments, a durable Refund workflow model, customer/admin cancellation paths that request refunds for paid online orders, admin refund approval/processing/failure endpoints with audit hooks, Razorpay refund processing support, and targeted cancellation/refund tests. |
| 2026-05-19 | Sprint 4.3 Product search and catalog UX | Completed | Added sanitized backend product search/filter helpers, availability-aware catalog queries, indexed flavor/city/stock search paths, safer search cache keys, URL-backed frontend search filters for category/flavor/occasion/city/price/availability/sort, and targeted product-search tests plus frontend build validation. |
| 2026-05-19 | Sprint 4.4 CDN and image optimization | Completed | Added tested Cloudinary transformation helpers, CDN-aware media URL resolution, production Next image remote patterns and long image cache TTLs, optimized product/category/banner/add-on image rendering, frontend image environment examples, and CDN-friendly backend upload/cache headers. |
| 2026-05-19 | Sprint 4.5 Admin operational dashboard | Completed | Added cached live-operations metrics for payment health, refund queue, low stock, open operational alerts, failed notifications, high-risk COD orders, abandoned carts, active reservations, and coupon usage, then surfaced them in the admin dashboard with targeted dashboard tests and frontend build validation. |
| 2026-05-19 | Sprint 4.6 Backend automated tests | Completed | Added focused backend tests for admin middleware authorization, coupon usage identity normalization and discount caps, reservable inventory item shaping, loyalty event stability, and dashboard count helpers, expanding the backend regression suite to 87 passing tests. |
| 2026-05-19 | Sprint 4.7 Frontend automated tests | Completed | Added dependency-free frontend utility tests for customer-facing price/date formatting, slug generation, occasion labels, rating display, and truncation, while preserving existing image optimization and security-header tests in a 17-test targeted frontend suite. |
| 2026-05-19 | Sprint 4.8 Release readiness checklist | Completed | Added a root release readiness checklist covering production infrastructure gates, secrets, Razorpay and Meta webhooks, CDN/image settings, validation commands, ecommerce smoke tests, high-traffic edge cases, rollback planning, launch monitoring, and go/no-go signoff. |
