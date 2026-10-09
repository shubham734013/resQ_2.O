import { app } from './app.js';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from './config/database.js';
import { env } from './config/env.js';

const startServer = async (): Promise<void> => {
  await connectDatabase();
  const server = app.listen(env.PORT, () => console.info(`ResQ API listening on port ${env.PORT}`));

  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`${signal} received. Shutting down gracefully...`);

    const forceExitTimeout = setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(async (err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      }
      try {
        await disconnectDatabase();
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? sanitizeMongoUri(dbErr.message) : 'Unknown db disconnect error';
        console.error('Error during database disconnect:', msg);
      }
      clearTimeout(forceExitTimeout);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? sanitizeMongoUri(error.message) : 'Unknown startup error';
  console.error(`ResQ API failed to start: ${message}`);
  process.exit(1);
});

