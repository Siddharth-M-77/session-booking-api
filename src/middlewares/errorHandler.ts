import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: unknown[] | undefined = undefined;

  // 1. Handled Operational Errors (ApiError)
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors.length > 0 ? err.errors : undefined;
  }
  // 2. Zod Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = err.errors.map((issue) => ({
      field: issue.path.join('.').replace(/^(body|query|params)\.?/, ''),
      message: issue.message,
    }));
  }
  // 3. Mongoose CastError (e.g. invalid ObjectId in query or model operations)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }
  // 4. Mongoose ValidationError
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  }
  // 5. MongoDB Duplicate Key Error (Code 11000)
  else if ((err as MongoError).code === 11000) {
    statusCode = 409;
    const mongoErr = err as MongoError;
    const duplicateFields = mongoErr.keyValue ? Object.keys(mongoErr.keyValue).join(', ') : 'field';
    const duplicateValues = mongoErr.keyValue ? JSON.stringify(mongoErr.keyValue) : '';
    message = `Duplicate key error: A record with ${duplicateFields} (${duplicateValues}) already exists`;
  }
  // 6. Generic/Unhandled Error
  else {
    message = err.message || 'Internal Server Error';
  }

  const responseBody: {
    success: boolean;
    message: string;
    errors?: unknown[];
    stack?: string;
  } = {
    success: false,
    message,
  };

  if (errors !== undefined) {
    responseBody.errors = errors;
  }

  // Include stack trace only in development/test environments
  if (env.NODE_ENV !== 'production' && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};
