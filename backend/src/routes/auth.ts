import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { prisma } from '../config/prisma';

const router = Router();
const client = new OAuth2Client(config.google.clientId);

router.post('/google', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || '',
          avatar: payload.picture || null,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { email: payload.email },
        data: { name: payload.name || user.name, avatar: payload.picture || user.avatar },
      });
    }

    return res.json({ user, token });
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

export default router;
