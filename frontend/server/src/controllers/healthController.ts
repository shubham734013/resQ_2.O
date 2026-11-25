import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const healthController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'CONNECTED';

    if (isHealthy) {
      sendSuccess(res, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbHealth,
      }, 200);
      return;
    }

    res.status(503).json({
      success: false,
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: dbHealth,
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: {
          status: 'DISCONNECTED',
          readyState: 0,
        },
      },
    });
  }
};

