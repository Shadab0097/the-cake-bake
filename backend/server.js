const { env, validateEnv } = require('./src/config/env');

// Validate environment variables before anything else
validateEnv();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/middleware/logger');

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server
    const server = app.listen(env.port, () => {
      logger.info(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║    🎂  The Cake Bake API Server              ║
  ║                                              ║
  ║    Environment: ${env.nodeEnv.padEnd(28)}║
  ║    Port:        ${String(env.port).padEnd(28)}║
  ║    URL:         http://localhost:${String(env.port).padEnd(13)}║
  ║    API:         http://localhost:${String(env.port)}/api/v1   ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force close after 10s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection:', err);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
