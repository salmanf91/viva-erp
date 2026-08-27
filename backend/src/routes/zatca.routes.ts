import { Router } from 'express';
import { getZatcaConfig, saveZatcaConfig, onboardZatcaOtp, getZatcaInvoices } from '../controllers/zatca.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/config', getZatcaConfig);
router.post('/config', saveZatcaConfig);
router.post('/onboard', onboardZatcaOtp);
router.get('/invoices', getZatcaInvoices);

export default router;
