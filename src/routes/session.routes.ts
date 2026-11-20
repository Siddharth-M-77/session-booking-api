import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';
import { validate } from '../middlewares/validate';
import { validateObjectId } from '../middlewares/validateObjectId';
import {
  createSessionSchema,
  bookSessionSchema,
  availableSessionsQuerySchema,
} from '../validators/session.validator';

const router = Router();

router.post('/', validate(createSessionSchema), sessionController.createSession);
router.get(
  '/available',
  validate(availableSessionsQuerySchema),
  sessionController.getAvailableSessions,
);
router.post(
  '/:id/book',
  validateObjectId('id'),
  validate(bookSessionSchema),
  sessionController.bookSession,
);
router.patch('/:id/complete', validateObjectId('id'), sessionController.completeSession);

export default router;
