import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getClients, addClient, updateClient, deactivateClient, reactivateClient,
  getCategoryRates, upsertCategoryRate,
  getOrders, getOrder, createOrder, updateOrder, markPaid, recordPayment, deleteOrder, getSalesSummary,
  getNightiesCategorySummary,
} from '../controllers/sales.controller';

const router = Router();
router.use(authenticate);

// Clients
router.get('/clients',      getClients);
router.post('/clients',     addClient);
router.put('/clients/:id',            updateClient);
router.put('/clients/:id/deactivate', deactivateClient);
router.put('/clients/:id/reactivate', reactivateClient);

// Category rates
router.get('/rates',  getCategoryRates);
router.post('/rates', upsertCategoryRate);

// Orders
router.get('/summary',      getSalesSummary);
router.get('/nighties-summary', getNightiesCategorySummary);
router.get('/',             getOrders);
router.get('/:id',          getOrder);
router.post('/',            createOrder);
router.put('/:id',          updateOrder);
router.put('/:id/pay',      markPaid);
router.post('/:id/payment', recordPayment);
router.delete('/:id',       deleteOrder);

export default router;
