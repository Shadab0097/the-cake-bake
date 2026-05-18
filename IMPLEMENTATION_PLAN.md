# The Cake Bake — Production Ecommerce Implementation Plan

This document is intended to be used by the project owner or another AI/model as the authoritative implementation plan before coding begins.

## Important instruction

Do not start coding until the owner explicitly approves the scope.

Recommended approval options:

- `Approve Sprint 1 only`
- `Approve Sprint 1 + Sprint 2`
- `Approve full implementation plan`
- `Modify the plan first`

---

# 1. Project context

The Cake Bake is an ecommerce website for cakes and related products. The expected production environment includes high traffic, concurrent sales, guest checkout, authenticated checkout, COD, Razorpay online payments, coupons, loyalty points, admin operations, uploads, notifications, and order tracking.

The main goal is to make the platform production-ready like a large ecommerce store such as Amazon/Flipkart in terms of:

- Correct stock handling under concurrent checkout
- No duplicate orders from retries/double-clicks
- Reliable payment lifecycle
- Safe coupons and loyalty points
- Secure customer/admin sessions
- Smooth guest and authenticated checkout UX
- Operational monitoring and recovery tools
- Scalable caching, queues, and rate limiting
- Strong admin controls and auditability

---

# 2. Key audited files and areas

## Backend

- `backend/src/app.js`
- `backend/server.js`
- `backend/src/config/db.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/validate.js`
- `backend/src/middleware/upload.js`
- `backend/src/modules/orders/order.service.js`
- `backend/src/modules/orders/guest.checkout.routes.js`
- `backend/src/modules/orders/order.lifecycle.js`
- `backend/src/modules/orders/orderExpiry.service.js`
- `backend/src/modules/payments/payment.service.js`
- `backend/src/modules/cart/cart.service.js`
- `backend/src/modules/coupons/coupon.service.js`
- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/auth/auth.validation.js`
- `backend/src/modules/admin/admin.routes.js`
- `backend/src/modules/chatbot/chatbot.controller.js`
- `backend/src/modules/media/upload.service.js`
- `backend/src/models/Order.js`
- `backend/src/models/Payment.js`
- `backend/src/models/Product.js`
- `backend/src/models/Variant.js`
- `backend/src/models/Coupon.js`
- `backend/src/models/CouponUsage.js`
- `backend/src/models/Cart.js`
- `backend/src/models/User.js`
- `backend/src/models/LoyaltyPoints.js`
- `backend/src/models/JobLock.js`

## Frontend

- `frontend/src/lib/api.js`
- `frontend/src/lib/adminApiClient.js`
- `frontend/src/store/slices/authSlice.js`
- `frontend/src/store/slices/cartSlice.js`
- `frontend/src/app/admin-login/page.js`
- `frontend/src/app/order-confirmation/page.js`
- `frontend/src/app/order-tracking/[orderNumber]/page.js`
- `frontend/src/components/layout/AppShell.jsx`
- `frontend/next.config.mjs`

---

# 3. Main risks found during audit

## Critical risks

1. Stock can oversell during concurrent orders.
2. Online orders do not reserve stock before payment.
3. Checkout has no backend idempotency protection.
4. Loyalty points can be redeemed incorrectly under concurrency.
5. Coupon usage limits can be bypassed under concurrent checkout.
6. Payment/webhook handling must be made fully idempotent.

## High risks

1. Customer and admin tokens are stored in `localStorage`.
2. Guest order tracking is not properly wired because tracking currently requires login.
3. Checkout validation can create saved addresses as a side effect.
4. WhatsApp webhook POST handler lacks Meta signature verification.
5. Rate limiting uses in-memory limits, unsuitable for multi-instance production.
6. Health endpoint exposes operational details.

## Medium risks

1. Frontend lacks production security headers/CSP.
2. Production image/domain config is incomplete.
3. More operational dashboards and alerts are needed.
4. Queue-based background processing is needed for high traffic.
5. Advanced search/cache/CDN strategy should be added over time.

---

# 4. Implementation principles

Any implementation should follow these rules:

1. Backend is authoritative for stock, pricing, discounts, loyalty, and payment status.
2. Frontend totals are display-only and must never be trusted.
3. All checkout/payment operations must be idempotent.
4. Critical order/payment/stock/coupon/loyalty operations must be transaction-safe.
5. Webhooks must be verified and safe to process multiple times.
6. User-facing checkout failures must be recoverable and understandable.
7. Admin operations must be protected, logged, and auditable.
8. Production rate limits, cache, and queues should use shared infrastructure such as Redis.
9. No public endpoint should expose sensitive operational details.
10. Tests must cover concurrent ecommerce scenarios, not only happy paths.

---

# 5. Phase 1 — Critical order, inventory, and payment correctness

This is the most important phase and should be completed before launch.

## 5.1 Atomic stock reservation system

### Current problem

Stock is checked before checkout, but the actual decrement can fail under concurrency. In some flows, failed stock decrements are logged without aborting the order. Online orders decrement stock after payment capture, which can allow several users to pay for the same low-stock item.

### Required implementation

Create a stock reservation system.

For COD:

- Validate cart.
- Recalculate prices on backend.
- Reserve/decrement stock atomically inside the order transaction.
- Create order and COD payment record.
- Confirm order only if all stock updates succeed.

For online payment:

- Validate cart.
- Recalculate prices on backend.
- Reserve stock before creating Razorpay order.
- Create pending order and payment record.
- If payment succeeds, convert reservation to sold stock.
- If payment fails/expires/cancels, release reservation.

### Suggested data model

Create an `InventoryReservation` model or equivalent fields.

Fields may include:

- `order`
- `user`
- `guestEmail`
- `guestPhone`
- `items`
- `variant`
- `quantity`
- `status`: `reserved`, `confirmed`, `released`, `expired`
- `expiresAt`
- `confirmedAt`
- `releasedAt`
- `reason`

### Stock update rule

Use conditional update logic like:

- update variant only when `stock >= quantity`
- fail and abort if any item cannot be reserved
- never commit an order if expected stock update count does not match actual modified count

### Acceptance criteria

- Two customers cannot buy the final same item at the same time.
- A paid order never exists without inventory reserved/confirmed.
- Expired or failed online payments release stock.
- COD order creation fails cleanly if stock is not available.

---

## 5.2 Checkout idempotency

### Current problem

Duplicate API requests can create duplicate orders. Frontend button guards are not enough.

### Required implementation

Add backend idempotency for:

- authenticated checkout
- guest checkout
- payment verification

### Suggested data model

Create an `IdempotencyKey` model.

Fields may include:

- `key`
- `scope`: `checkout`, `guest_checkout`, `payment_verify`
- `user`
- `guestFingerprint`
- `requestHash`
- `status`: `processing`, `completed`, `failed`
- `responsePayload`
- `lockedUntil`
- `expiresAt`

### Flow

1. Frontend generates a unique idempotency key before checkout submit.
2. Backend checks whether the same key already exists.
3. If completed, return the existing response.
4. If processing, return a safe in-progress response or wait/retry.
5. If new, lock the key and process the request.
6. Store final response.

### Acceptance criteria

- Double-clicking place order creates one order only.
- Browser retry returns the same order/payment result.
- Duplicate Razorpay orders are not created for the same checkout attempt.

---

## 5.3 Payment lifecycle hardening

### Current problem

Payment verification and webhooks can be retried. They must not double-confirm an order, double-clear cart, double-earn loyalty, or double-change stock.

### Required implementation

Use a strict payment state machine.

Payment states:

- `created`
- `pending`
- `authorized`
- `captured`
- `failed`
- `expired`
- `refunded`

Order payment states:

- `pending`
- `paid`
- `failed`
- `expired`
- `refunded`

Rules:

- Captured payment should confirm order once.
- Failed/expired payment should cancel/release once.
- Webhook retries should be safe.
- Client verification and webhook should converge to the same final state.

### Required technical fixes

- Use timing-safe signature comparison for Razorpay verification.
- Store processed webhook event IDs or use idempotent event processing.
- Re-check payment/order status inside transaction before changing state.
- Add a reconciliation job to compare Razorpay and local DB states.

### Acceptance criteria

- Razorpay webhook retry is harmless.
- Client verify retry is harmless.
- Payment captured but DB pending is automatically detected and repaired.
- Payment failed/expired releases stock and loyalty points once.

---

# 6. Phase 2 — Coupon, loyalty, pricing, and cart correctness

## 6.1 Atomic coupon usage

### Current problem

Coupon usage is checked before checkout, but concurrent checkout can exceed global or per-user limits.

### Required implementation

- Revalidate coupon inside final checkout transaction.
- Increment coupon usage only with conditional guard.
- Add database-level uniqueness where applicable.
- Track guest coupon usage by normalized email/phone when guest checkout is supported.

### Suggested DB constraints

- Unique usage record for same `coupon + order`.
- Prevent duplicate same coupon usage for same user/order.
- For per-user limit, use transaction-safe counting or maintain atomic usage counters.

### Acceptance criteria

- Global coupon usage limit cannot be exceeded.
- Per-user coupon limit cannot be bypassed by concurrent requests.
- Coupon discount is always calculated by backend.

---

## 6.2 Loyalty point race-condition fix

### Current problem

Two concurrent checkouts may redeem the same loyalty balance.

### Required implementation

- Deduct points with conditional DB update: only if balance is enough.
- Add ledger idempotency for earn/redeem/refund events.
- Restore redeemed points only once if online payment fails/expires/cancels.

### Suggested ledger rule

Use unique reference by:

- `user`
- `referenceId`
- `eventType`

Examples:

- `order_created_redeem`
- `order_payment_failed_restore`
- `order_delivered_earn`

### Acceptance criteria

- Loyalty balance cannot go negative.
- Same order cannot redeem/restore/earn points twice.
- Failed online order restores points once.

---

## 6.3 Server-authoritative pricing

### Required implementation

Final price must be calculated only on backend using:

- product price
- variant price
- add-ons
- eggless option charges if applicable
- delivery charge
- coupon discount
- loyalty redemption
- tax if added later

Frontend price should be treated only as display.

### Acceptance criteria

- DevTools price manipulation cannot change payable amount.
- Razorpay amount equals backend final amount.
- Order total, payment amount, and invoice amount match.

---

# 7. Phase 3 — Authentication and security hardening

## 7.1 Move refresh tokens out of localStorage

### Current problem

Customer and admin access/refresh tokens are stored in `localStorage`. If any XSS exists, long-lived refresh tokens can be stolen.

### Required implementation

- Store refresh token in `HttpOnly`, `Secure`, `SameSite` cookie.
- Keep access token short-lived.
- Prefer access token in memory where feasible.
- Hash refresh tokens before storing in DB.
- Rotate refresh token on every refresh.
- Detect refresh token reuse.
- Separate admin/customer refresh handling.

### Acceptance criteria

- JavaScript cannot read refresh tokens.
- Logout invalidates the server-side token.
- Reused refresh token invalidates the session.

---

## 7.2 Admin panel security

### Required implementation

- Enforce stricter admin login rate limits.
- Add suspicious login logging.
- Consider MFA/TOTP for admin accounts.
- Use shorter admin session lifetime.
- Add audit logs for sensitive admin actions.

Audit these actions:

- product create/update/delete
- price update
- stock update
- coupon create/update/delete
- order status update
- refund action
- admin/customer role changes

### Acceptance criteria

- Admin actions are traceable.
- Admin session compromise risk is reduced.
- Sensitive operations have audit history.

---

## 7.3 Webhook and public endpoint security

### Required implementation

For Razorpay:

- use timing-safe signature verification
- require webhook secret in production
- process events idempotently

For WhatsApp/Meta:

- verify POST webhook signature using `X-Hub-Signature-256`
- reject spoofed/unsigned requests
- rate limit webhook endpoint where appropriate

For health endpoints:

- public liveness endpoint should return minimal status only
- detailed readiness/config should be private or internal
- remove public memory, PID, environment, and provider config exposure

### Acceptance criteria

- Fake webhook requests cannot trigger business logic.
- Public health endpoint does not leak operational details.

---

## 7.4 Distributed production rate limiting

### Current problem

In-memory rate limiting does not work reliably across multiple backend instances.

### Required implementation

Use Redis-backed rate limiting for:

- login
- admin login
- registration
- forgot/reset password
- phone verification
- coupon validation
- checkout
- guest checkout
- payment verification
- inquiry/contact forms
- webhook endpoints if appropriate

### Acceptance criteria

- Rate limits work across multiple backend instances.
- Restarting a process does not reset abuse limits.
- High-risk endpoints have stricter limits.

---

# 8. Phase 4 — Guest checkout and customer experience

## 8.1 Guest order tracking

### Current problem

Guest checkout can place an order, but order tracking requires login.

### Recommended implementation

Use signed guest tracking tokens.

Flow:

1. Guest order is created.
2. Backend generates secure tracking token.
3. Confirmation page links to guest tracking route with token.
4. Backend validates token before returning limited order details.

Alternative:

- Order number + phone/email OTP verification.

### Acceptance criteria

- Guest can track their order without account login.
- Guest cannot access another guest's order.
- Authenticated users still use normal account order tracking.

---

## 8.2 Make checkout validation side-effect free

### Current problem

Checkout validation can create saved addresses.

### Required implementation

- `validateCheckout` should only validate and calculate.
- Address should be saved only during final order creation.
- Add optional `saveAddress` flag if needed.

### Acceptance criteria

- Repeated validation does not create address records.
- Address creation only happens intentionally.

---

## 8.3 Checkout recovery UX

### Required implementation

Handle these frontend states clearly:

- payment popup closed
- payment pending
- payment failed
- payment expired
- retry payment
- stock became unavailable
- coupon became invalid
- loyalty points changed

For online payment:

- Keep pending order for expiry window.
- Allow retry if reservation is still valid.
- Do not create multiple abandoned Razorpay orders unnecessarily.

### Acceptance criteria

- User can recover from payment popup failure.
- Cart/order state is not confusing after failure.
- User sees clear reason when checkout cannot proceed.

---

# 9. Phase 5 — Scalability features for large ecommerce traffic

## 9.1 Redis caching strategy

### Required implementation

Use shared Redis cache for production.

Cache public data:

- categories
- product listing
- product details
- featured products
- bestsellers
- banners
- add-ons
- delivery slots

Invalidate cache when admin changes:

- products
- variants
- stock
- prices
- categories
- banners
- add-ons

### Acceptance criteria

- Product/catalog pages remain fast during high traffic.
- Admin changes invalidate affected cache correctly.

---

## 9.2 Queue-based background jobs

### Required implementation

Use a queue system such as BullMQ with Redis.

Move these tasks out of request-response:

- order confirmation email
- WhatsApp notifications
- invoice generation
- abandoned cart reminders
- review reminders
- low-stock alerts
- payment reconciliation
- stock reservation expiry
- admin operational alerts

### Acceptance criteria

- Checkout response is fast.
- Notification failure does not fail order creation.
- Jobs retry safely and are observable.

---

## 9.3 Database indexes and query performance

### Required implementation

Review/add indexes for:

- `Order.user + createdAt`
- `Order.orderNumber`
- `Order.status + createdAt`
- `Order.paymentStatus + createdAt`
- `Payment.razorpayOrderId`
- `Payment.razorpayPaymentId`
- `Product.slug`
- `Product.category + isActive`
- `Variant.product + isActive`
- `Coupon.code`
- `CouponUsage.coupon + user`
- `Cart.user`
- guest tracking token/hash
- chatbot logs by phone/date

### Acceptance criteria

- Admin order dashboard remains fast.
- Customer account order page remains fast.
- Payment lookup is fast and reliable.

---

## 9.4 Product search and catalog UX

### Required implementation

Improve search/filtering:

- sanitized query
- category filter
- flavor filter
- occasion filter
- price sorting
- availability filter
- delivery city filter

Future upgrade:

- use Meilisearch, Typesense, or Elasticsearch for typo-tolerant search.

### Acceptance criteria

- Customers can find products quickly.
- Search does not overload MongoDB.

---

## 9.5 CDN and image optimization

### Required implementation

- Finalize production image domains in `frontend/next.config.mjs`.
- Use Cloudinary transformations for thumbnails/cards/detail pages.
- Add CDN caching headers.
- Ensure product/category/banner images work in production.

### Acceptance criteria

- Images load quickly.
- Mobile users receive optimized images.
- Production deployment does not break image loading.

---

# 10. Phase 6 — Fraud, abuse, cancellation, and refund controls

## 10.1 COD abuse protection

### Required implementation

Add velocity/risk checks for:

- same phone placing many COD orders
- same address repeatedly cancelling
- same IP creating many guest orders
- suspicious phone/email patterns
- high-value COD orders

Optional controls:

- OTP verification for high-value COD
- disable COD for risky users
- require prepaid amount for expensive/custom cakes

### Acceptance criteria

- Fake COD spam is reduced.
- Genuine customers are not blocked unnecessarily.

---

## 10.2 Cancellation and refund workflow

### Required implementation

Define order cancellation rules:

- pending/confirmed can be cancellable
- preparing/packed may not be cancellable for cake/custom products
- custom cakes may have stricter cancellation policy

Add refund workflow:

- refund requested
- refund approved
- refund processing
- refunded
- refund failed

Integrate Razorpay refund API if required.

### Acceptance criteria

- Customer sees clear cancellation rules.
- Admin refund actions are tracked.
- Payment/order/refund state remains consistent.

---

# 11. Phase 7 — Observability and operations

## 11.1 Logging and monitoring

### Required implementation

Track important events:

- order created
- checkout idempotency duplicate
- stock reservation failed
- payment captured
- webhook failed
- Razorpay/DB mismatch
- coupon limit hit
- loyalty restore failed
- admin login failed
- suspicious checkout attempt

Suggested tools:

- Sentry for frontend/backend errors
- Datadog/New Relic/Logtail for logs/APM
- uptime monitoring
- alerting for payment/order mismatches

### Acceptance criteria

- Production incidents are visible quickly.
- Critical payment/order mismatches trigger alerts.

---

## 11.2 Admin operational dashboard

### Required implementation

Add admin visibility for:

- today's orders by status
- pending payments
- expired payments
- failed payments
- low-stock products
- failed notifications
- high-risk COD orders
- coupon usage
- abandoned carts
- refund queue

### Acceptance criteria

- Admin can manage live operations during traffic spikes.
- Operational problems are visible before customers complain.

---

# 12. Phase 8 — Frontend security and UX hardening

## 12.1 Frontend security headers

### Required implementation

Add Next.js production headers:

- Content Security Policy with Razorpay allowlist
- HSTS
- `X-Frame-Options` or CSP `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Content-Type-Options`

### Acceptance criteria

- Frontend has browser-level protections.
- Razorpay checkout works with CSP.

---

## 12.2 Checkout UI protection

### Required implementation

- Disable submit while order is being created.
- Generate and send idempotency key.
- Show clear loading states.
- Show stock/coupon/payment errors clearly.
- Clear cart only after final order success.
- Preserve or restore cart after payment failure when appropriate.

### Acceptance criteria

- Users do not accidentally create duplicate orders.
- Failed payment flow is understandable and recoverable.

---

# 13. Phase 9 — Automated tests and release readiness

## 13.1 Backend tests

Add tests for:

- concurrent purchase of same low-stock variant
- duplicate checkout idempotency
- duplicate payment verification
- Razorpay webhook retry
- coupon global limit race
- coupon per-user limit race
- loyalty points concurrent redemption
- online payment expiry releasing stock
- guest tracking authorization
- admin route authorization
- health endpoint privacy

## 13.2 Frontend tests

Add tests for:

- checkout happy path
- payment popup closed/failed path
- guest order confirmation and tracking
- login refresh handling
- admin login flow
- cart preservation after payment failure

## 13.3 Release readiness checklist

Before production launch:

- MongoDB replica set enabled for transactions
- Redis available for cache/rate limits/queues
- Razorpay live keys configured
- Razorpay webhook secret configured
- WhatsApp webhook signature secret configured
- SMTP configured
- Cloudinary configured
- production frontend API URLs configured
- production image domains configured
- frontend CSP tested with Razorpay
- backups enabled
- monitoring enabled
- admin account secured
- health/readiness endpoints hardened
- payment reconciliation job enabled
- stock reservation expiry job enabled

---

# 14. Recommended execution order

## Sprint 1 — Must-fix before launch

1. Atomic stock reservation/decrement
2. Checkout idempotency
3. Payment lifecycle hardening
4. Coupon atomic usage
5. Loyalty atomic redemption/restoration
6. Guest order tracking fix
7. Side-effect-free checkout validation

## Sprint 2 — Security hardening

1. HttpOnly refresh token cookies
2. Refresh token rotation and hashing
3. Admin session hardening
4. Razorpay webhook hardening
5. WhatsApp webhook signature verification
6. Redis-backed rate limiting
7. Health endpoint hardening
8. Frontend security headers

## Sprint 3 — Scale and operations

1. Redis cache
2. Queue-based background jobs
3. Payment reconciliation job
4. Stock reservation expiry job improvements
5. Admin operational dashboard improvements
6. Monitoring and alerting
7. Database index optimization

## Sprint 4 — Ecommerce polish

1. COD fraud rules
2. Refund workflow
3. Search improvements
4. CDN/image optimization
5. Checkout recovery UX
6. Automated frontend/backend tests

---

# 15. Suggested first coding batch

The safest first coding batch is Sprint 1:

1. Implement stock reservation and strict stock decrement failure handling.
2. Add checkout idempotency for authenticated and guest checkout.
3. Make payment confirmation/webhooks fully idempotent.
4. Make coupon usage transaction-safe.
5. Make loyalty redemption/restoration transaction-safe.
6. Fix guest order tracking.
7. Make checkout validation side-effect free.

Do not begin implementation until the owner approves this batch or modifies the scope.
