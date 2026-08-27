import { Router } from 'express';
import { getAllTenantsAdmin, toggleTenantStatus, deleteTenant } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getAllTenantsAdmin);
router.patch('/:id/status', toggleTenantStatus);
router.delete('/:id', deleteTenant);

export default router;
