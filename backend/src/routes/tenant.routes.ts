import { Router } from 'express';
import {
  getAllTenantsAdmin,
  toggleTenantStatus,
  deleteTenant,
  getTenantModules,
  updateTenantModules
} from '../controllers/tenant.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Module management (accessible to tenant owner or super admin)
router.get('/:id/modules', getTenantModules);
router.put('/:id/modules', updateTenantModules);

// Super Admin only routes
router.get('/', requireSuperAdmin, getAllTenantsAdmin);
router.patch('/:id/status', requireSuperAdmin, toggleTenantStatus);
router.delete('/:id', requireSuperAdmin, deleteTenant);

export default router;
