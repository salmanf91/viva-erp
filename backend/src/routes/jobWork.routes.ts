import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getJobOrders,
  getJobOrderDetail,
  createJobOrder,
  updateJobOrder,
  markJobDelivered,
  deleteJobOrder,
  addStaffAssignment,
  updateStaffAssignment,
  deleteStaffAssignment,
  addJobExpense,
  deleteJobExpense,
  getStaffPayoutsSummary,
  recordStaffPayout,
  deleteStaffPayout,
  getBranches,
  addBranch
} from '../controllers/jobWork.controller';

const router = Router();
router.use(authenticate);

// Dynamic Branches
router.get('/branches',            getBranches);
router.post('/branches',           addBranch);

// Orders CRUD & Delivery
router.get('/',                    getJobOrders);
router.post('/',                   createJobOrder);
router.get('/:id',                 getJobOrderDetail);
router.put('/:id',                 updateJobOrder);
router.post('/:id/deliver',        markJobDelivered);
router.delete('/:id',              deleteJobOrder);

// Staff Assignments inside orders
router.post('/:id/assignments',                 addStaffAssignment);
router.put('/assignments/:assignmentId',        updateStaffAssignment);
router.delete('/assignments/:assignmentId',     deleteStaffAssignment);

// Expenses inside orders
router.post('/:id/expenses',                    addJobExpense);
router.delete('/expenses/:expenseId',           deleteJobExpense);

// Standalone Staff Wages & Payouts (Option A)
router.get('/staff/payouts',                    getStaffPayoutsSummary);
router.post('/staff/payouts',                   recordStaffPayout);
router.delete('/staff/payouts/:payoutId',       deleteStaffPayout);

export default router;

