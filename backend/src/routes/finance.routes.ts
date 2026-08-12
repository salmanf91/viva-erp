import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getPnL, getCashLedger, getPartyLedgerParties, getClientLedger, getVendorLedger } from '../controllers/finance.controller';

const router = Router();
router.use(authenticate);
router.get('/pnl',                  getPnL);
router.get('/cash-ledger',          getCashLedger);
router.get('/party-ledger/parties',  getPartyLedgerParties);
router.get('/party-ledger/client/:id', getClientLedger);
router.get('/party-ledger/vendor/:id', getVendorLedger);
export default router;
