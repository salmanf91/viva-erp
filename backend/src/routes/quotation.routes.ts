import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getQuotations,
  getQuotationDetail,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertToSalesOrder
} from '../controllers/quotation.controller';

const router = Router();

router.use(authenticate);

router.get('/',            getQuotations);
router.get('/:id',         getQuotationDetail);
router.post('/',           createQuotation);
router.put('/:id',         updateQuotation);
router.delete('/:id',      deleteQuotation);
router.post('/:id/convert', convertToSalesOrder);

export default router;
