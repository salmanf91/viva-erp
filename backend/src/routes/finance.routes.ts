import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getPnL, getCashLedger } from '../controllers/finance.controller';

const router = Router();
router.use(authenticate);
router.get('/pnl',         getPnL);
router.get('/cash-ledger', getCashLedger);
export default router;
