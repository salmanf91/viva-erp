import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDeliveryNotes,
  getDeliveryNoteDetail,
  createDeliveryNote,
  createFromSalesOrder,
  updateDeliveryNote,
  updateDeliveryStatus,
  deleteDeliveryNote
} from '../controllers/deliveryNote.controller';

const router = Router();

router.use(authenticate);

router.get('/',                       getDeliveryNotes);
router.get('/:id',                    getDeliveryNoteDetail);
router.post('/',                      createDeliveryNote);
router.post('/from-order/:orderId',   createFromSalesOrder);
router.put('/:id',                    updateDeliveryNote);
router.put('/:id/status',             updateDeliveryStatus);
router.delete('/:id',                 deleteDeliveryNote);

export default router;
