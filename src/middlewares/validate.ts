import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AnyZodObject, ZodEffects, ZodError } from 'zod';

type ValidationSchema = AnyZodObject | ZodEffects<AnyZodObject>;

export const validate = (schema: ValidationSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Assign sanitized and parsed values back to request
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      if (parsed.query !== undefined) {
        req.query = parsed.query;
      }
      if (parsed.params !== undefined) {
        req.params = parsed.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
};
