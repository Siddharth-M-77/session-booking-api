import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { validate } from '../middlewares/validate';
import { validateObjectId } from '../middlewares/validateObjectId';
import { createUserSchema } from '../validators/user.validator';

const router = Router();

router.post('/', validate(createUserSchema), userController.createUser);
router.get('/:id/sessions', validateObjectId('id'), userController.getUserSessions);

export default router;
