import { Router } from 'express';
import { getItems, getItemById, createItem, updateItem, deleteItem, getUomList } from '../controllers/item.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/uoms', getUomList);
router.get('/', getItems);
router.get('/:id', getItemById);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
