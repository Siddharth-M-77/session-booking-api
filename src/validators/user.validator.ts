import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    fullName: z
      .string({ required_error: 'Full name is required' })
      .trim()
      .min(1, 'Full name cannot be empty'),
    email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
    phone: z.string({ required_error: 'Phone is required' }).trim().min(1, 'Phone cannot be empty'),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
