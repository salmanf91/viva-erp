import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getBatches, getBatchDetail, createBatch, finishBatch, deleteBatch, updateBatch, updateBatchStatus, getProductConfigs, updateProductConfig, deleteProductConfig } from '../controllers/production.controller';

const router = Router();
router.use(authenticate);
router.get('/configs',       getProductConfigs);
router.put('/configs/:category', updateProductConfig);
router.delete('/configs/:category', deleteProductConfig);
router.get('/',              getBatches);
router.post('/',             createBatch);
router.get('/:id',           getBatchDetail);
router.put('/:id/finish',    finishBatch);
router.put('/:id',           updateBatch);
router.put('/:id/status',    updateBatchStatus);
router.delete('/:id',        deleteBatch);
export default router;
