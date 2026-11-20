import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes';
import { notFoundHandler } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

export const createApp = (): Application => {
  const app = express();

  // Security HTTP headers
  app.use(helmet());

  // Enable CORS
  app.use(cors());

  // Body parser for JSON
  app.use(express.json());

  // HTTP request logger in development mode
  if (env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // API Routes
  app.use('/', apiRoutes);

  // Handle 404 for unknown routes
  app.use(notFoundHandler);

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
