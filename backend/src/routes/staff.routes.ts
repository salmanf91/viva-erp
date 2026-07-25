import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getStaff, addStaff, updateStaff, deactivateStaff, reactivateStaff,
  getStaffAdmins, createStaffAdmin, removeStaffAdmin,
  getWorkEntries, getStaffHistory, upsertWorkEntry, deleteWorkEntry,
  getPayrollSummary, settleStaff, getLaborLiability,
} from '../controllers/staff.controller';

const router = Router();
router.use(authenticate);

// Staff members
router.get('/',               getStaff);
router.post('/',              addStaff);
router.put('/:id',            updateStaff);
router.delete('/:id',         deactivateStaff);
router.put('/:id/reactivate', reactivateStaff);

// Staff admin users (owner-only management)
router.get('/admins',         getStaffAdmins);
router.post('/admins',        createStaffAdmin);
router.delete('/admins/:id',  removeStaffAdmin);

// Daily work entries
router.get('/work-entries',         getWorkEntries);
router.get('/work-entries/history', getStaffHistory);
router.post('/work-entries',        upsertWorkEntry);
router.delete('/work-entries/:id',  deleteWorkEntry);

// Payroll
router.get('/payroll',   getPayrollSummary);
router.post('/settle',   settleStaff);
router.get('/liability', getLaborLiability);

export default router;
