import { z } from 'zod';
import { objectIdSchema } from './common.validator';

const parseDateOrTimestamp = (val: unknown): Date => {
  if (typeof val === 'number') {
    return new Date(val);
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && /^\d+$/.test(val.trim())) {
      return new Date(num);
    }
    return new Date(val);
  }
  if (val instanceof Date) {
    return val;
  }
  return new Date(NaN);
};

export const createSessionSchema = z.object({
  body: z
    .object({
      teacherId: objectIdSchema,
      startTime: z
        .preprocess(
          parseDateOrTimestamp,
          z.date({
            required_error: 'startTime is required',
            invalid_type_error: 'startTime must be a valid ISO date string or epoch timestamp',
          }),
        )
        .refine((date) => !isNaN(date.getTime()), {
          message: 'startTime must be a valid date',
        }),
      endTime: z
        .preprocess(
          parseDateOrTimestamp,
          z.date({
            required_error: 'endTime is required',
            invalid_type_error: 'endTime must be a valid ISO date string or epoch timestamp',
          }),
        )
        .refine((date) => !isNaN(date.getTime()), {
          message: 'endTime must be a valid date',
        }),
    })
    .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
      message: 'endTime must be strictly greater than startTime',
      path: ['endTime'],
    }),
});

export const bookSessionSchema = z.object({
  body: z.object({
    userId: objectIdSchema,
  }),
});

export const availableSessionsQuerySchema = z.object({
  query: z.object({
    dateTimestamp: z
      .string({ required_error: 'dateTimestamp query parameter is required' })
      .trim()
      .min(1, 'dateTimestamp query parameter cannot be empty')
      .refine(
        (val) => {
          const num = Number(val);
          return !isNaN(num) && Number.isInteger(num) && num > 0;
        },
        {
          message: 'dateTimestamp must be a valid positive integer epoch timestamp in milliseconds',
        },
      )
      .transform((val) => Number(val))
      .refine(
        (val) => {
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        {
          message: 'dateTimestamp cannot be converted to a valid date',
        },
      ),
  }),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>['body'];
export type BookSessionInput = z.infer<typeof bookSessionSchema>['body'];
