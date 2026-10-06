import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPartners, addCapitalPayment, updateCapitalPayment, deleteCapitalPayment,
  getCapitalPayments, getPartnerLedger, getReminders, addReminder, resolveReminder
} from '../controllers/partner.controller';

const router = Router();
router.use(authenticate);
router.get('/',                        getPartners);
router.post('/payments',               addCapitalPayment);
router.put('/payments/:id',            updateCapitalPayment);
router.delete('/payments/:id',         deleteCapitalPayment);
router.get('/:partner_id/payments',    getCapitalPayments);
router.get('/:id/ledger',              getPartnerLedger);
router.get('/reminders',               getReminders);
router.post('/reminders',              addReminder);
router.put('/reminders/:id/resolve',   resolveReminder);
export default router;
