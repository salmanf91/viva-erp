import { Router } from 'express';
import { login, getTenants, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.post('/login', login);
router.get('/tenants', getTenants);
router.put('/change-password', authenticate, changePassword);
export default router;
