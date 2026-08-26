import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { config } from '../config';
import { prisma } from '../config/prisma';
import { transporter } from '../config/mailer';

interface EmailJobData {
  emailId: string;
  to: string;
  subject: string;
  body: string;
  sender: string;
}

async function checkRateLimit(sender: string): Promise<boolean> {
  const hourKey = `ratelimit:${sender}:${Math.floor(Date.now() / 3600000)}`;
  const count = await redisConnection.incr(hourKey);
  if (count === 1) {
    await redisConnection.expire(hourKey, 3600);
  }
  if (count > config.rateLimit.maxEmailsPerHourPerSender) {
    await redisConnection.decr(hourKey);
    return false;
  }
  return true;
}

async function processEmail(job: Job<EmailJobData>) {
  const { emailId, to, subject, body, sender } = job.data;

  // Check idempotency — skip if already sent
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email || email.status === 'SENT') {
    return { skipped: true, reason: 'already sent or not found' };
  }

  // Rate limit check
  const allowed = await checkRateLimit(sender);
  if (!allowed) {
    // Reschedule to next hour window
    const nextWindowMs = (Math.floor(Date.now() / 3600000) + 1) * 3600000 - Date.now();
    throw new Error(`RATE_LIMITED:${nextWindowMs}`);
  }

  // Mark as sending
  await prisma.email.update({ where: { id: emailId }, data: { status: 'SENDING' } });

  // Enforce delay between sends
  await new Promise((resolve) => setTimeout(resolve, config.rateLimit.delayBetweenEmailsMs));

  // Send via Ethereal
  await transporter.sendMail({
    from: `"${sender}" <${config.smtp.user}>`,
    to,
    subject,
    html: body,
  });

  // Mark as sent
  await prisma.email.update({
    where: { id: emailId },
    data: { status: 'SENT', sentAt: new Date() },
  });

  return { sent: true, to, subject };
}

const worker = new Worker<EmailJobData>('email-send', processEmail, {
  connection: redisConnection,
  concurrency: config.rateLimit.workerConcurrency,
});

worker.on('failed', async (job, error) => {
  if (!job) return;

  // If rate limited, reschedule with delay instead of marking as failed
  if (error.message.startsWith('RATE_LIMITED:')) {
    const delayMs = parseInt(error.message.split(':')[1]);
    const { emailId } = job.data;
    // Re-add job with delay to next hour window
    const { emailQueue } = await import('../config/queue');
    await emailQueue.add('send-email', job.data, {
      delay: delayMs,
      jobId: `${emailId}-retry-${Date.now()}`,
    });
    return;
  }

  // Mark as failed in DB after all retries exhausted
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    await prisma.email.update({
      where: { id: job.data.emailId },
      data: { status: 'FAILED', failedReason: error.message },
    });
  }
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('ready', () => {
  console.log('[Worker] Email worker ready');
});

console.log(`[Worker] Started with concurrency=${config.rateLimit.workerConcurrency}`);
