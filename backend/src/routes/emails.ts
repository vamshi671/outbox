import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { emailQueue } from '../config/queue';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// Schedule emails
router.post('/schedule', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, emails: emailsJson, scheduledAt, sender, delayBetweenMs, hourlyLimit } = req.body;

    let recipients: string[] = [];

    // Parse from uploaded CSV/text file
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      recipients = content
        .split(/[\n,;]+/)
        .map((e: string) => e.trim())
        .filter((e: string) => e.includes('@'));
    }

    // Or from JSON body
    if (emailsJson) {
      const parsed = JSON.parse(emailsJson);
      recipients = [...recipients, ...parsed];
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid email recipients' });
    }

    if (!subject || !body || !scheduledAt) {
      return res.status(400).json({ error: 'subject, body, and scheduledAt are required' });
    }

    const baseTime = new Date(scheduledAt).getTime();
    const delay = parseInt(delayBetweenMs || '2000');
    const senderName = sender || 'default';

    const emailRecords = recipients.map((to, index) => ({
      id: uuidv4(),
      userId: req.user!.id,
      to,
      subject,
      body,
      sender: senderName,
      scheduledAt: new Date(baseTime + index * delay),
      idempotencyKey: `${req.user!.id}-${to}-${subject}-${baseTime}`,
    }));

    // Bulk create in DB
    await prisma.email.createMany({
      data: emailRecords,
      skipDuplicates: true,
    });

    // Schedule BullMQ delayed jobs
    const jobs = emailRecords.map((email) => {
      const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
      return {
        name: 'send-email',
        data: {
          emailId: email.id,
          to: email.to,
          subject: email.subject,
          body: email.body,
          sender: email.sender,
        },
        opts: {
          delay: delayMs,
          jobId: email.id,
        },
      };
    });

    await emailQueue.addBulk(jobs);

    // Update bullJobId references
    await Promise.all(
      emailRecords.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: { bullJobId: email.id, status: 'QUEUED' },
        })
      )
    );

    return res.json({
      message: `Scheduled ${emailRecords.length} emails`,
      count: emailRecords.length,
    });
  } catch (error: any) {
    console.error('Schedule error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
});

// Get scheduled emails
router.get('/scheduled', async (req: AuthRequest, res: Response) => {
  const emails = await prisma.email.findMany({
    where: {
      userId: req.user!.id,
      status: { in: ['SCHEDULED', 'QUEUED'] },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  return res.json(emails);
});

// Get sent emails
router.get('/sent', async (req: AuthRequest, res: Response) => {
  const emails = await prisma.email.findMany({
    where: {
      userId: req.user!.id,
      status: { in: ['SENT', 'SENDING', 'FAILED'] },
    },
    orderBy: { sentAt: 'desc' },
  });
  return res.json(emails);
});

export default router;
