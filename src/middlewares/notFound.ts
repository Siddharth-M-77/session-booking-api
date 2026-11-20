import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';

export const notFoundHandler: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
