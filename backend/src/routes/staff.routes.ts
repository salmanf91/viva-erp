import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStaff, addStaff, deactivateStaff, getPayrollSummary, settleStaff, getLaborLiability } from '../controllers/staff.controller';

const router = Router();
router.use(authenticate);
router.get('/',              getStaff);
router.post('/',             addStaff);
router.delete('/:id',        deactivateStaff);
router.get('/payroll',       getPayrollSummary);
router.post('/settle',       settleStaff);
router.get('/liability',     getLaborLiability);
export default router;
