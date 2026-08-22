import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getOverviewReport,
  getSalesReport,
  getPurchaseReport,
  getProductionReport,
  getStaffReport,
  getExpenseReport,
  getPnLReport,
  getInventoryReport,
} from '../controllers/report.controller';

const router = Router();
router.use(authenticate);

router.get('/overview',   getOverviewReport);
router.get('/sales',      getSalesReport);
router.get('/purchases',  getPurchaseReport);
router.get('/production', getProductionReport);
router.get('/staff',      getStaffReport);
router.get('/expenses',   getExpenseReport);
router.get('/pnl',        getPnLReport);
router.get('/inventory',  getInventoryReport);

export default router;
