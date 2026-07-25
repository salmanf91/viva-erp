import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getAccessoryCosts, getLatestAccessoryCosts, addAccessoryCost, deleteAccessoryCost } from '../controllers/accessory.controller';

const router = Router();
router.use(authenticate);

router.get('/',        getAccessoryCosts);
router.get('/latest',  getLatestAccessoryCosts);
router.post('/',       addAccessoryCost);
router.delete('/:id',  deleteAccessoryCost);

export default router;
