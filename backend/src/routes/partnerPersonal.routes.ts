import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPersonalAccountsSummary,
  getPartnerPersonalLedger,
  createPersonalEntry,
  updatePersonalEntry,
  deletePersonalEntry,
} from '../controllers/partnerPersonal.controller';

const router = Router();

router.use(authenticate);

router.get('/summary', getPersonalAccountsSummary);
router.get('/ledger/:partnerId', getPartnerPersonalLedger);
router.post('/entries', createPersonalEntry);
router.put('/entries/:id', updatePersonalEntry);
router.delete('/entries/:id', deletePersonalEntry);

export default router;
