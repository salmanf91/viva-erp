import { Router } from 'express';
import { login, getTenants, changePassword, registerTenant } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.post('/login', login);
router.get('/tenants', getTenants);
router.post('/register-tenant', registerTenant);
router.put('/change-password', authenticate, changePassword);
export default router;
