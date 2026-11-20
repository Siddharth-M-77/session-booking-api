import { z } from 'zod';
import mongoose from 'mongoose';

export const objectIdSchema = z
  .string({ required_error: 'ID is required' })
  .trim()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId format',
  });
