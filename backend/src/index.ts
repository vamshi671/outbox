import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start worker in the same process (Render free tier doesn't support separate workers)
import './workers/emailWorker';
import { prisma } from './config/prisma';
import { emailQueue } from './config/queue';

// Recover emails stuck in SENDING (from cold start kills)
async function recoverStuckEmails() {
  const stuck = await prisma.email.findMany({ where: { status: 'SENDING' } });
  for (const email of stuck) {
    await prisma.email.update({ where: { id: email.id }, data: { status: 'QUEUED' } });
    await emailQueue.add('send-email', {
      emailId: email.id,
      to: email.to,
      subject: email.subject,
      body: email.body,
      sender: email.sender,
    }, { jobId: `${email.id}-recover-${Date.now()}` });
  }
  if (stuck.length) console.log(`[Recovery] Re-queued ${stuck.length} stuck emails`);
}

app.listen(config.port, () => {
  console.log(`[Server] Running on port ${config.port}`);
  recoverStuckEmails().catch(console.error);
});
