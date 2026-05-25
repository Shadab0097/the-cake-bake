# Backend Production Runtime

The backend can run in separate roles so VPS scaling does not duplicate background work.

## Roles

- `PROCESS_ROLE=web`: Express API only.
- `PROCESS_ROLE=worker`: BullMQ notification worker only.
- `PROCESS_ROLE=scheduler`: order expiry, payment reconciliation, and inventory reservation expiry only.
- `PROCESS_ROLE=all`: local development convenience; runs API, worker, and scheduler together.

Use `all` for local development. Use separate roles in production.

## Minimum Production Environment

```env
NODE_ENV=production
REDIS_URL=redis://localhost:6379
JOB_QUEUE_MODE=bullmq
CACHE_STORE=redis
RATE_LIMIT_STORE=redis
DB_POOL_SIZE=20
DB_MIN_POOL_SIZE=2
JOB_WORKER_CONCURRENCY=5
```

Set `PROCESS_ROLE` per process instead of sharing one value across all processes.

Production startup also requires safe configuration values. The backend fails fast if it detects placeholder JWT secrets, localhost CORS/app URLs, missing Razorpay webhook secret, missing Cloudinary credentials, missing readiness token, or non-BullMQ production queues.

## PM2 Layout

Use `ecosystem.config.cjs` as the starting VPS process layout:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Recommended starting size for a 4 vCPU / 8 GB VPS:

- `cakebake-api`: 2 instances
- `cakebake-notification-worker`: 1 instance
- `cakebake-scheduler`: 1 instance

Increase API instances first when request latency rises. Increase notification workers only when the BullMQ notification backlog grows. Keep exactly one scheduler process.

## Safety Notes

- Do not run `PROCESS_ROLE=all` behind PM2 cluster mode in production.
- Do not run dedicated `worker` role with `JOB_QUEUE_MODE=inline`; use Redis/BullMQ.
- Keep `ALLOW_TEST_PAYMENT_KEYS=false` and `ALLOW_INSECURE_PRODUCTION_ORIGINS=false` for real production.
- Keep MongoDB Atlas connection limits in mind: `DB_POOL_SIZE * process_count` is the approximate upper bound.
- Store uploads in Cloudinary or another object store for production; local `uploads/` is not durable across servers.
