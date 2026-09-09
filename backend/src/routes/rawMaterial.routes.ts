import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getRawMaterials, createRawMaterial, updateRawMaterial, deleteRawMaterial } from '../controllers/rawMaterial.controller';

const router = Router();
router.use(authenticate);

router.get('/', getRawMaterials);
router.post('/', createRawMaterial);
router.put('/:id', updateRawMaterial);
router.delete('/:id', deleteRawMaterial);

export default router;
