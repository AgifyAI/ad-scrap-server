import { env } from '@/common/utils/envConfig';
import { app, logger } from '@/server';

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

// Configure server timeout for long-running requests (35 minutes)
server.timeout = 35 * 60 * 1000; // 35 minutes
server.keepAliveTimeout = 36 * 60 * 1000; // 36 minutes (slightly higher than timeout)
server.headersTimeout = 37 * 60 * 1000; // 37 minutes (higher than keepAliveTimeout)

const onCloseSignal = () => {
  logger.info('sigint received, shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on('SIGINT', onCloseSignal);
process.on('SIGTERM', onCloseSignal);
