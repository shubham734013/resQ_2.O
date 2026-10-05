import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

const startServer = async (): Promise<void> => {
  await connectDatabase();
  const server = app.listen(env.PORT, () => console.info(`ResQ API listening on port ${env.PORT}`));

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`${signal} received. Shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

startServer().catch((error: unknown) => {
  console.error('ResQ API failed to start');
  console.error(error);
  process.exit(1);
});
