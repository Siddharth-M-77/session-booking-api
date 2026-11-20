import { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';

export const validateObjectId = (paramName = 'id'): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new ApiError(
          400,
          `Invalid ${paramName} parameter: must be a valid 24-character hexadecimal ObjectId`,
        ),
      );
    }

    next();
  };
};
