# Email Scheduler - ReachInbox Assignment

## Overview

This project is a local email scheduling application. A user signs in with Google, uploads a CSV or TXT file of recipients, composes an HTML email, and schedules one delivery per recipient. The React dashboard displays scheduled, sent, and failed records. Emails are delivered through Ethereal SMTP for testing, so they are captured by Ethereal rather than delivered to real inboxes.

The API stores email records in PostgreSQL and schedules delayed BullMQ jobs in Redis. A separate worker consumes those jobs and sends the messages.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend API | Express.js, TypeScript, CORS, Multer |
| Authentication | Google OAuth 2.0 using `@react-oauth/google` and `google-auth-library` |
| Database | PostgreSQL 16 with Prisma ORM |
| Queue | BullMQ backed by Redis 7 and ioredis |
| Email | Nodemailer with Ethereal SMTP |
| Local infrastructure | Docker Compose |

## Features

### Frontend

- Google Sign-In and client-side auth state persistence in `localStorage`.
- Dashboard tabs for Scheduled and Sent/Failed emails.
- Five-second polling to refresh both email lists.
- Compose modal with subject, body, sender name, recipient file, start time, and delay fields.
- CSV/TXT recipient parsing with a detected-address count.
- Email tables with recipient, subject, time, and status columns.
- Loading, empty, success, and error states.
- Responsive Tailwind-based layout and logout control.

### Backend

- Express API for Google authentication and email scheduling.
- One PostgreSQL `Email` record and one delayed BullMQ job per recipient.
- Persistent scheduled/sent/failed email state through Prisma and PostgreSQL.
- Redis-backed hourly per-sender send limit.
- Configurable BullMQ worker concurrency.
- Configurable delay before each SMTP send.
- BullMQ retries with exponential backoff for ordinary processing errors.
- Idempotency checks in the worker to skip records already marked `SENT`.
- Ethereal SMTP transport for safe test delivery.
- Health endpoint at `GET /api/health`.

## Project Structure

```text
backend/
  prisma/                 Prisma schema and initial migration
  src/
    config/               Environment, Prisma, Redis, queue, and mailer setup
    middleware/auth.ts    Google ID-token verification and user lookup
    routes/               Authentication and email API routes
    workers/              BullMQ email worker
frontend/
  src/
    api.ts                Axios API client and auth header
    components/           Header, compose modal, and email table
    hooks/useAuth.ts      Local auth state and persistence
    pages/                Login and dashboard screens
docker-compose.yml        PostgreSQL and Redis containers with named volumes
test-recipients.csv       Example recipient input file
```

## Prerequisites

- Node.js 18 or newer.
- npm.
- Docker and Docker Compose.
- A Google OAuth web client configured for `http://localhost:5173`.
- An Ethereal Email account and SMTP credentials.

## Environment Variables

Create `backend/.env` from `backend/env.example`. The backend reads these variables with the following defaults:

| Variable | Purpose | Default or requirement |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Required; local Compose value is shown below |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Express listening port | `3001` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID used to verify ID tokens | Required |
| `GOOGLE_CLIENT_SECRET` | Stored configuration for the Google OAuth client | Required by the example configuration; not read by the current source code |
| `SMTP_HOST` | SMTP host | `smtp.ethereal.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Ethereal SMTP username | Required for authenticated SMTP |
| `SMTP_PASS` | Ethereal SMTP password | Required for authenticated SMTP |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Hourly worker limit | `200` |
| `DELAY_BETWEEN_EMAILS_MS` | Delay before each SMTP call | `2000` |
| `WORKER_CONCURRENCY` | Number of BullMQ jobs processed in parallel | `5` |

Use placeholders only. Never commit `.env` files or real credentials.

Example `backend/.env` values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/email_scheduler
REDIS_URL=redis://localhost:6379
PORT=3001
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
MAX_EMAILS_PER_HOUR_PER_SENDER=200
DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5
```

The frontend reads one Vite variable. Create `frontend/.env` with:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Use the same client ID in both applications. The frontend API URL is currently fixed in `frontend/src/api.ts` as `http://localhost:3001/api`; there is no frontend API URL environment variable.

## Ethereal Email Setup

1. Visit [ethereal.email](https://ethereal.email) and create a test account.
2. Copy the generated SMTP host, port, username, and password.
3. Put them in `backend/.env` as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
4. Run the worker and schedule a message from the dashboard.
5. View captured messages in the Ethereal message preview using the account credentials. Ethereal does not deliver these messages to real recipient inboxes.

## Google OAuth Setup

Create a Google OAuth web client and add `http://localhost:5173` to its authorized JavaScript origins. Put the client ID in both `.env` files as described above. The backend verifies the ID token audience and uses the token email to find or create the local user.

## Running the Backend

From the repository root, start PostgreSQL and Redis:

```bash
docker-compose up -d
```

Compose exposes PostgreSQL at `localhost:5434` and Redis at `localhost:6379`. The named `pgdata` and `redisdata` volumes retain their data while those volumes are kept.

Install dependencies and generate/apply the Prisma client and migration:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

Create `backend/.env`, then run the API in one terminal:

```bash
npm run dev
```

The API listens on `http://localhost:3001` by default. In a second terminal, start the BullMQ worker:

```bash
cd backend
npm run worker
```

Other backend scripts are `npm run build` for TypeScript compilation and `npm start` to run the compiled `dist/index.js`.

## Running the Frontend

In another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` with `VITE_GOOGLE_CLIENT_ID`, then start Vite:

```bash
npm run dev
```

Open `http://localhost:5173`. The production build command is `npm run build`; the preview command is `npm run preview`.

## Architecture Overview

### Email Scheduling

1. The frontend sends `multipart/form-data` to `POST /api/emails/schedule` with the message fields and recipient file.
2. The API parses addresses separated by newlines, commas, or semicolons and validates the subject, body, schedule time, and recipient list.
3. PostgreSQL receives one `Email` row per recipient. Each row contains a scheduled time offset by `delayBetweenMs * recipient index`.
4. The API adds one BullMQ delayed job per row to the `email-send` queue. The delay is calculated from that row's scheduled time.
5. The worker receives due jobs, checks the corresponding database row, applies the Redis hourly limit, marks the row `SENDING`, waits for `DELAY_BETWEEN_EMAILS_MS`, and calls Nodemailer.
6. Successful sends are marked `SENT` with `sentAt`. Ordinary errors are retried up to three attempts with exponential backoff; after the final attempt the row is marked `FAILED`.

There is no cron job or polling loop responsible for sending. The dashboard's five-second polling only refreshes displayed data.

### Persistence on Restart

Email records are persisted in PostgreSQL, and delayed/failed/completed BullMQ jobs are retained in Redis because the queue options set `removeOnComplete` and `removeOnFail` to `false`. Docker Compose mounts both services to named volumes. Therefore, restarting the API or worker does not remove future delayed jobs. When the worker reconnects, BullMQ can continue processing jobs stored in Redis.

This guarantee assumes Redis is available and its `redisdata` volume is retained. Removing the volume or losing Redis data removes the queue state. A job that has already been sent is skipped if it is delivered to the worker again and its database row is already `SENT`.

### Rate Limiting

Before sending, the worker increments a Redis key shaped like `ratelimit:{sender}:{hour bucket}`. The bucket is the Unix epoch hour, so this is a fixed hourly window rather than a rolling 60-minute window. The first increment gets a 3,600-second TTL. If the count exceeds `MAX_EMAILS_PER_HOUR_PER_SENDER`, the increment is reversed and the job is re-added with a delay until the next hour bucket.

The default limit is 200 messages per sender per hour. The `hourlyLimit` form value is submitted by the frontend but is not read by the current backend, so the environment variable is the effective configuration.

### Concurrency

The worker is created with BullMQ's `concurrency` option, read from `WORKER_CONCURRENCY` and defaulting to 5. This allows up to that many jobs to be processed by the worker process at once. Each job also waits for `DELAY_BETWEEN_EMAILS_MS` immediately before its SMTP call. Multiple worker processes could share the same queue, but this project starts one worker process by default.

## API Overview

All email routes require `Authorization: Bearer <Google ID token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/google` | Verify a Google ID token and find or create the local user |
| `POST` | `/api/emails/schedule` | Accept a recipient file and create delayed email jobs |
| `GET` | `/api/emails/scheduled` | Return the current user's `SCHEDULED` and `QUEUED` emails |
| `GET` | `/api/emails/sent` | Return the current user's `SENT` and `FAILED` emails |
| `GET` | `/api/health` | Return an unauthenticated API health response |

## Restart Scenario

1. Start Docker Compose, the API, and the worker.
2. Sign in, upload `test-recipients.csv`, choose a future start time, and schedule the email.
3. Stop the API and/or worker process. Leave Redis running for the simplest demonstration; stopping the worker is the relevant test for delayed-job recovery.
4. Start the same process again with `npm run dev` and/or `npm run worker`.
5. The email row remains in PostgreSQL and the delayed BullMQ job remains in Redis. After its scheduled delay expires, the worker processes it and updates the row to `SENT` or `FAILED`.

If Redis and its Docker volume are deleted, the queue job cannot be recovered by this implementation. The database row alone does not recreate a missing BullMQ job.

## Demo Video

[Demo Video](PASTE_VIDEO_LINK_HERE)

The demonstration should show scheduling emails, the Scheduled and Sent/Failed dashboard tabs, and the restart scenario. It may also show the hourly limit and worker concurrency configuration.

## Assumptions / Trade-offs

- Ethereal is used as a test SMTP sink; this project is not configured for production email delivery.
- The frontend requires a recipient file; although the API also accepts a JSON `emails` field, the current compose UI does not use that path.
- Recipient parsing is intentionally simple: text is split on newlines, commas, and semicolons, and entries containing `@` are accepted. It is not a full email-address validator.
- Hourly rate limiting uses fixed epoch-hour buckets and is shared by workers through Redis. The compose modal's hourly-limit input is currently informational because the API ignores that field.
- One delay is applied per recipient at scheduling time, and the worker applies another configured wait before each SMTP call. Actual send times can therefore be later than the scheduled times under load.
- The worker runs as a separate process. BullMQ supports shared queue processing, but this repository does not provide process supervision or deployment configuration.
- The dashboard uses five-second HTTP polling rather than WebSockets.
- Google ID tokens are stored in browser `localStorage` and sent on requests until they expire; there is no refresh-token flow.
- There is no cancellation, editing, attachment, or retry control in the current UI.

## Submission Checklist

- [ ] Repository visibility is set to private on GitHub.
- [ ] No `.env` files, credentials, API keys, or passwords are committed.
- [ ] README explains backend, worker, infrastructure, frontend, environment, architecture, restart behavior, and trade-offs.
- [ ] Ethereal SMTP credentials are configured locally using placeholders in examples.
- [ ] PostgreSQL migration and Redis are running locally.
- [ ] API and BullMQ worker are started in separate terminals.
- [ ] Frontend starts and Google Sign-In is configured for `http://localhost:5173`.
- [ ] Demo video link replaces `PASTE_VIDEO_LINK_HERE`.
- [ ] Demo covers scheduled emails, dashboard results, and restart recovery.
