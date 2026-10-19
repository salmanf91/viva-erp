import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getCatalogItems,
  getCatalogItemById,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getPublicShowcase
} from '../controllers/catalog.controller';

const router = Router();

// Public showcase endpoint for vendors and customers (no login required)
router.get('/public/:type', getPublicShowcase);

// Admin dashboard endpoints (authentication required)
router.use(authenticate);

router.get('/', getCatalogItems);
router.get('/:id', getCatalogItemById);
router.post('/', createCatalogItem);
router.put('/:id', updateCatalogItem);
router.delete('/:id', deleteCatalogItem);

export default router;
