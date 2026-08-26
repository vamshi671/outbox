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

app.listen(config.port, () => {
  console.log(`[Server] Running on port ${config.port}`);
});
