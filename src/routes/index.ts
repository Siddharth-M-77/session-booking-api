import { Router } from 'express';
import userRoutes from './user.routes';
import teacherRoutes from './teacher.routes';
import sessionRoutes from './session.routes';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

router.use('/users', userRoutes);
router.use('/teachers', teacherRoutes);
router.use('/sessions', sessionRoutes);

export default router;
