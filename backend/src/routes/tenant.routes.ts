import { Router } from 'express';
import { getAllTenantsAdmin, toggleTenantStatus, deleteTenant } from '../controllers/tenant.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/', getAllTenantsAdmin);
router.patch('/:id/status', toggleTenantStatus);
router.delete('/:id', deleteTenant);

export default router;
