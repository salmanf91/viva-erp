import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getStockSummary, getStockByVendor, getDashboardStats } from '../controllers/stock.controller';

const router = Router();
router.use(authenticate);
router.get('/summary',       getStockSummary);
router.get('/by-vendor',     getStockByVendor);
router.get('/dashboard',     getDashboardStats);
export default router;
