import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.ALLOWED_ORIGINS.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin denied.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-pin'],
  maxAge: 600
}));
app.use(express.json({ limit: '50kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);
app.use(errorHandler);

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, '');
}
