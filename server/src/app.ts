import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/healthRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { hospitalRouter } from './routes/hospitalRoutes.js';
import { ambulanceProviderRouter, ambulanceDriverRouter } from './routes/ambulanceOperationsRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/hospital', hospitalRouter);
app.use('/api/v1/ambulance-provider', ambulanceProviderRouter);
app.use('/api/v1/ambulance-driver', ambulanceDriverRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);
