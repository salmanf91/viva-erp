import { Router } from 'express';
import { login, superAdminLogin, getTenants, changePassword, registerTenant } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authLimiter, provisionLimiter } from '../middleware/rateLimiter';

const router = Router();
router.post('/login', authLimiter, login);
router.post('/super-admin/login', authLimiter, superAdminLogin);
router.get('/tenants', getTenants);
router.post('/register-tenant', provisionLimiter, registerTenant);
router.put('/change-password', authenticate, changePassword);
export default router;
