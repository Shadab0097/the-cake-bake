# VPS Production Deployment Guide

This project is ready to run as separate production processes. Do not use the local development runtime for VPS traffic.

## Target Process Layout

Start with this layout on a 4 vCPU / 8 GB VPS:

```txt
Nginx/Caddy -> frontend :3000
Nginx/Caddy -> backend API :5000
Redis       -> BullMQ, cache, rate limits
MongoDB     -> Atlas recommended
Cloudinary  -> image uploads

PM2:
  cakebake-frontend x 1
  cakebake-api x 2
  cakebake-notification-worker x 1
  cakebake-scheduler x 1
```

Scale API instances first when request latency rises. Scale notification workers only when queue backlog grows. Keep the scheduler at exactly one process.

## Required Setup

1. Install Node.js LTS, Redis, PM2, and Nginx or Caddy on the VPS.
2. Configure `backend/.env` from `backend/.env.production.example`.
3. Configure `frontend/.env.production` from `frontend/.env.production.example`.
4. Run installs and builds:

```bash
cd backend && npm ci
cd ../frontend && npm ci && npm run build
```

5. Start PM2 from the repository root:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Required Production Values

The backend refuses unsafe production config. Replace placeholders before starting:

- Public HTTPS `APP_URL` and `CORS_ORIGIN`
- Strong, different `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Live Razorpay keys and `RAZORPAY_WEBHOOK_SECRET`
- `REDIS_URL`
- `HEALTH_CHECK_TOKEN`
- Cloudinary credentials
- SMTP/WhatsApp credentials if those notification channels are enabled

## Health Checks

Public health:

```bash
curl https://api.example.com/api/v1/health
```

Private readiness:

```bash
curl -H "x-health-check-token: $HEALTH_CHECK_TOKEN" https://api.example.com/api/v1/health/readiness
```

## Operational Notes

- Use HTTPS at the proxy.
- Keep local `uploads/` out of the production storage path; use Cloudinary.
- Watch MongoDB connection limits: approximate max is `DB_POOL_SIZE * backend process count`.
- Keep Redis persistent enough for queue recovery.
- Enable log rotation for PM2 logs.
- Back up MongoDB Atlas and Cloudinary assets.
