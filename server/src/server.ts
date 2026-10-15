import { createServer } from 'node:http';
import { app } from './app.js';
import { initializeTrackingSockets } from './services/trackingSocketService.js';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from './config/database.js';
import { env } from './config/env.js';
import { startDispatchWorker } from './services/dispatchService.js';

const startServer = async (): Promise<void> => {
  await connectDatabase();
  const stopDispatchWorker = startDispatchWorker();
  const server = createServer(app);
  const stopTrackingSockets = initializeTrackingSockets(server);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[ResQ Server Error] Port ${env.PORT} is already in use by another process.\n` +
        `To identify and terminate the existing process, run:\n` +
        `  lsof -ti :${env.PORT} | xargs kill -9\n`
      );
      process.exit(1);
    }
    console.error(`ResQ HTTP server error: ${err.message}`);
    process.exit(1);
  });

  server.listen(env.PORT, () => console.info(`ResQ API listening on port ${env.PORT}`));

  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`\n${signal} received. Initiating graceful shutdown...`);

    const forceExitTimeout = setTimeout(() => {
      console.error('Forced shutdown due to timeout (10s)');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    try {
      stopDispatchWorker();
    } catch (dispatchErr: unknown) {
      console.error('Error stopping dispatch worker:', dispatchErr instanceof Error ? dispatchErr.message : dispatchErr);
    }

    try {
      await stopTrackingSockets();
    } catch (socketErr: unknown) {
      console.error('Error closing Socket.IO:', socketErr instanceof Error ? socketErr.message : 'Unknown Socket.IO close error');
    }

    if (server.listening) {
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
            console.error('Error closing HTTP server:', err.message);
          }
          resolve();
        });
        if ('closeAllConnections' in server && typeof (server as unknown as { closeAllConnections?: () => void }).closeAllConnections === 'function') {
          (server as unknown as { closeAllConnections: () => void }).closeAllConnections();
        }
      });
    }

    try {
      await disconnectDatabase();
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? sanitizeMongoUri(dbErr.message) : 'Unknown db disconnect error';
      console.error('Error during database disconnect:', msg);
    }

    clearTimeout(forceExitTimeout);
    console.info('Graceful shutdown complete. Exiting cleanly.');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? sanitizeMongoUri(error.message) : 'Unknown startup error';
  console.error(`ResQ API failed to start: ${message}`);
  process.exit(1);
});

