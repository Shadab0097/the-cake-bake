# The Cake Bake - Release Readiness Checklist

Use this as the production launch gate. Do not mark the release ready until every blocker item is verified in the target production environment, not only on local development.

## Release Signoff

- [ ] Release date and time:
- [ ] Release version or commit:
- [ ] Backend deployment target:
- [ ] Frontend deployment target:
- [ ] Approver:
- [ ] Rollback owner:

## Blocker Gates

- [ ] MongoDB is a replica set or Atlas cluster so checkout, payment, coupon, loyalty, and refund transactions can run safely.
- [ ] MongoDB automated backups and point-in-time restore are enabled and a restore drill has been tested.
- [ ] All schema indexes are built before traffic is shifted to the release.
- [ ] Redis is available and shared by all backend instances for rate limits, cache, locks, and BullMQ jobs.
- [ ] `NODE_ENV=production` is set for backend and frontend.
- [ ] Backend secrets are strong and production-only: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`, `HEALTH_CHECK_TOKEN`.
- [ ] Razorpay live key ID and key secret are configured, and the frontend uses the matching live `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- [ ] Razorpay webhook is configured to `POST /api/v1/payments/webhook` with the same `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Meta WhatsApp webhook is configured to `POST /api/v1/chatbot/webhook` with `X-Hub-Signature-256` enabled by `WHATSAPP_APP_SECRET`.
- [ ] `CORS_ORIGIN`, `APP_URL`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_API_BASE` point to production domains only.
- [ ] Cloudinary backend credentials and frontend image domain/CDN settings are configured.
- [ ] SMTP or the chosen transactional email provider is configured if email notifications are enabled.
- [ ] Operational alert webhook or monitoring destination is configured and tested.
- [ ] HTTPS, HSTS, CSP, and Razorpay checkout are verified in a production browser session.
- [ ] Public `/api/v1/health` returns only minimal liveness data.
- [ ] Private `/api/v1/health/readiness` is protected by admin auth or the internal health token.

## Required Validation Commands

Run these against the release build before launch.

Backend:

```powershell
cd backend
npm.cmd test
npm.cmd audit --omit=dev
```

Frontend:

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

If full lint remains blocked by unrelated legacy files, record the exact failures, run targeted lint for changed release files, and get an explicit owner exception before launch.

## Production Smoke Tests

- [ ] Customer registration, login, refresh, logout, and refresh-token reuse protection.
- [ ] Admin login, admin refresh, admin logout, and admin route authorization.
- [ ] Product listing, product detail, search filters, category pages, and image loading from CDN/Cloudinary.
- [ ] Authenticated COD checkout creates one order, reserves stock, records COD payment, and clears cart once.
- [ ] Authenticated online checkout creates one Razorpay order, captures payment, confirms stock, earns loyalty once, and clears cart once.
- [ ] Guest checkout creates a trackable order without requiring login.
- [ ] Guest tracking link only returns the intended limited order payload.
- [ ] Coupon validation, checkout consumption, duplicate retry, per-user limit, and global limit behavior.
- [ ] Loyalty redemption, duplicate retry, failed payment restore, late payment capture reapply, and delivered-order earn behavior.
- [ ] Payment verify retry and Razorpay webhook retry are idempotent.
- [ ] Payment failure, popup close, cancellation, and expiry release stock, coupon usage, and loyalty exactly once.
- [ ] Customer cancellation rules block invalid states and create refund requests for paid online orders.
- [ ] Admin refund approve, process, success, and failure paths update refund, payment, and order state consistently.
- [ ] Order expiry, stock reservation expiry, payment reconciliation, notification workers, and operational alerts are running in production mode.

## High-Traffic Edge Cases

- [ ] Flash-sale final-stock scenario: concurrent checkout attempts cannot oversell the same variant.
- [ ] Duplicate request scenario: browser retry or double-click cannot create duplicate orders or Razorpay orders.
- [ ] Payment race scenario: client verify and webhook arriving together confirm the order only once.
- [ ] Failure recovery scenario: unpaid online order expiry restores stock, coupon usage, and loyalty exactly once.
- [ ] Late capture scenario: a captured payment after a local failed/expired state is reconciled without double restore or double earn.
- [ ] Coupon exhaustion scenario: global and per-customer limits cannot be exceeded under concurrent checkout.
- [ ] Loyalty exhaustion scenario: two concurrent redemptions cannot push balance negative.
- [ ] COD abuse scenario: repeated phone, IP, address cancellation, disposable email, fake phone, and high-value COD attempts are reviewed or blocked.
- [ ] Admin operations scenario: price, stock, coupon, order, refund, and user role changes are audited.
- [ ] Multi-instance scenario: rate limits, cache invalidation, job locks, reconciliation, and reservation expiry behave correctly with more than one backend worker.

## Rollback Plan

- [ ] Previous backend artifact or commit is deployable.
- [ ] Previous frontend artifact or commit is deployable.
- [ ] Database migration or schema change rollback plan is documented.
- [ ] Cache flush plan is documented for Redis/catalog cache.
- [ ] Job queue pause/resume plan is documented for BullMQ workers.
- [ ] Razorpay webhook retry behavior is understood during rollback.
- [ ] Manual recovery playbook exists for stuck pending payments, reserved stock, refund failures, and notification failures.

## Launch Monitoring

Monitor these for at least the first 24 hours after launch.

- [ ] Checkout conversion and checkout error rate.
- [ ] Payment created, captured, failed, expired, and refunded counts.
- [ ] Pending payments older than the reconciliation threshold.
- [ ] Reserved stock older than the expiry threshold.
- [ ] Operational alerts by severity.
- [ ] API 5xx rate and latency.
- [ ] Redis connectivity and queue backlog.
- [ ] MongoDB CPU, memory, lock percentage, connection count, and slow queries.
- [ ] Razorpay webhook failure or retry rate.
- [ ] Email and WhatsApp notification failure rate.
- [ ] Refund queue age.

## Go/No-Go Decision

- [ ] Go
- [ ] No-go

Notes:

