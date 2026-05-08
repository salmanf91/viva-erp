import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getVendors, createVendor, getPurchases, getPurchaseDetail, createPurchase, updatePurchase, deletePurchase, resolveDispute } from '../controllers/purchase.controller';

const router = Router();
router.use(authenticate);
router.get('/vendors',                   getVendors);
router.post('/vendors',                  createVendor);
router.get('/',                          getPurchases);
router.post('/',                         createPurchase);
router.put('/disputes/:id',              resolveDispute);
router.get('/:id',                       getPurchaseDetail);
router.put('/:id',                       updatePurchase);
router.delete('/:id',                    deletePurchase);
export default router;
