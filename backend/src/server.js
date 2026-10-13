import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedIfEmpty } from './seed/seed.js';
import logger from './utils/logger.js';

const start = async () => {
  await connectDB();
  if (env.SEED_ON_START) await seedIfEmpty();

  const server = app.listen(env.PORT, () => logger.info('ResourceHub API listening', { port: env.PORT, env: env.NODE_ENV }));

  const shutdown = (signal) => {
    logger.info('Shutting down', { signal });
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
