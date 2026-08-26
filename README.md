# Email Scheduler – ReachInbox Assignment

A production-grade email scheduler service + dashboard built with BullMQ, Redis, PostgreSQL, Express, and React.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React UI  │────▶│  Express API │────▶│  PostgreSQL  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │   BullMQ     │────▶│    Redis     │
                    │   (Queue)    │     └─────────────┘
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │   Worker     │────▶│  Ethereal    │
                    │  (Processor) │     │   (SMTP)    │
                    └──────────────┘     └─────────────┘
```

### How Scheduling Works

1. User submits emails via the frontend (subject, body, CSV of recipients, start time, delay).
2. API creates records in PostgreSQL with status `SCHEDULED`, then adds **BullMQ delayed jobs** with the exact delay calculated from `scheduledAt - now()`.
3. BullMQ stores jobs in Redis. When the delay expires, the worker picks up the job.
4. **No cron** — scheduling relies entirely on BullMQ's built-in delayed job mechanism backed by Redis sorted sets.

### Persistence on Restart

- Jobs are stored in **Redis** (persistent via RDB snapshots in Docker volume).
- Email state is stored in **PostgreSQL**.
- On server restart, BullMQ workers reconnect to Redis and resume processing delayed jobs at their correct times — no re-scheduling needed.
- Idempotency is enforced via unique `idempotencyKey` per email (user + recipient + subject + timestamp), preventing duplicate sends.

### Rate Limiting & Concurrency

- **Per-sender hourly rate limit**: Uses Redis `INCR` with TTL on keys `ratelimit:{sender}:{hour_bucket}`. When limit is hit, the job throws a `RATE_LIMITED` error which triggers re-enqueue with a delay to the next hour window.
- **Delay between emails**: Configurable `DELAY_BETWEEN_EMAILS_MS` (default 2000ms) — enforced in the worker via `setTimeout` before each send.
- **Worker concurrency**: Configurable `WORKER_CONCURRENCY` (default 5) — BullMQ processes up to N jobs in parallel.
- **Under load (1000+ emails)**: Jobs are spread using per-email delay offsets at schedule time. Rate limiting ensures no more than `MAX_EMAILS_PER_HOUR_PER_SENDER` are sent per hour per sender, with overflow automatically rescheduled.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for Redis + Postgres)
- Google Cloud OAuth credentials
- Ethereal Email account (https://ethereal.email)

### 1. Start Infrastructure

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
cp env.example .env
# Edit .env with your credentials
npm install
npx prisma migrate dev --name init
npm run dev        # Start API server (port 3001)
npm run worker     # Start BullMQ worker (separate terminal)
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Create .env file:
echo 'VITE_GOOGLE_CLIENT_ID=your-google-client-id' > .env

npm run dev        # Start dev server (port 5173)
```

### 4. Ethereal Email Setup

1. Go to https://ethereal.email and click "Create Ethereal Account"
2. Copy the SMTP credentials into your backend `.env`:
   ```
   SMTP_HOST=smtp.ethereal.email
   SMTP_PORT=587
   SMTP_USER=your-user@ethereal.email
   SMTP_PASS=your-password
   ```
3. View sent emails at https://ethereal.email/messages (log in with same credentials)

### 5. Google OAuth Setup

1. Go to Google Cloud Console → APIs & Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:5173` to Authorized JavaScript Origins
4. Set `GOOGLE_CLIENT_ID` in both backend `.env` and frontend `.env`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/email_scheduler` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | — |
| `SMTP_HOST` | Ethereal SMTP host | `smtp.ethereal.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Ethereal username | — |
| `SMTP_PASS` | Ethereal password | — |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Rate limit per sender | `200` |
| `DELAY_BETWEEN_EMAILS_MS` | Min delay between sends | `2000` |
| `WORKER_CONCURRENCY` | Parallel job processing | `5` |

## Features Implemented

### Backend
- ✅ Email scheduling via BullMQ delayed jobs (no cron)
- ✅ PostgreSQL persistence for email records
- ✅ Redis-backed job queue (survives restarts)
- ✅ Per-sender hourly rate limiting (Redis counters)
- ✅ Configurable worker concurrency
- ✅ Configurable delay between emails
- ✅ Idempotent sends (unique keys prevent duplicates)
- ✅ Automatic rescheduling when rate limit hit
- ✅ Google OAuth token verification
- ✅ Bulk email scheduling with CSV upload

### Frontend
- ✅ Google OAuth login (real, not mocked)
- ✅ User header with name, email, avatar, logout
- ✅ Dashboard with Scheduled/Sent tabs
- ✅ Compose modal with CSV upload, scheduling options
- ✅ Email count detection from uploaded file
- ✅ Loading states and empty states
- ✅ Auto-refresh every 5 seconds
- ✅ Toast notifications for success/error

## Trade-offs & Assumptions

- **Single worker process**: Worker runs as a separate process (`npm run worker`). For horizontal scaling, run multiple worker instances — BullMQ handles distributed locking.
- **Rate limit granularity**: Hourly windows are based on Unix epoch hours, not rolling windows. Simpler, sufficient for this use case.
- **Auth simplicity**: Google ID token is stored client-side and sent with each request. No session/refresh flow — token expires per Google's default (~1hr). Production would add refresh tokens.
- **Delay stacking**: Emails in a batch are offset by `delayBetweenMs * index` at schedule time, spreading the load before it hits the worker.
