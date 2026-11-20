import { Server } from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';

let server: Server;

const startServer = async (): Promise<void> => {
  try {
    // 1. Connect to Database first
    await connectDB();

    // 2. Start listening on configured port
    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown logic
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    // Force close if graceful shutdown takes too long
    setTimeout(() => {
      console.error('Forcefully terminating process after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

// Register process listeners for graceful termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('UNHANDLED REJECTION! Shutting down...', reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Bootstrap application
startServer();
