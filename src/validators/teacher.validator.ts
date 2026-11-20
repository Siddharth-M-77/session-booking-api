import { z } from 'zod';

export const createTeacherSchema = z.object({
  body: z.object({
    fullName: z
      .string({ required_error: 'Full name is required' })
      .trim()
      .min(1, 'Full name cannot be empty'),
    email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
    specialization: z
      .string({ required_error: 'Specialization is required' })
      .trim()
      .min(1, 'Specialization cannot be empty'),
    experience: z
      .number({
        required_error: 'Experience is required',
        invalid_type_error: 'Experience must be a number',
      })
      .min(0, 'Experience must be greater than or equal to 0'),
  }),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>['body'];
