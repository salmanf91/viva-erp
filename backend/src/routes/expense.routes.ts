import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getReasons, addReason, getExpenses, addExpense, updateExpense, deleteExpense, archiveMonth, getOverhead, upsertOverhead, getExpenseSummary, getAccessoryPrices, reimburseExpense } from '../controllers/expense.controller';

const router = Router();
router.use(authenticate);
router.get('/reasons',           getReasons);
router.post('/reasons',          addReason);
router.get('/',                  getExpenses);
router.post('/',                 addExpense);
router.put('/:id',               updateExpense);
router.delete('/:id',            deleteExpense);
router.post('/archive',          archiveMonth);
router.get('/overhead',          getOverhead);
router.post('/overhead',         upsertOverhead);
router.get('/summary',           getExpenseSummary);
router.get('/accessory-prices',  getAccessoryPrices);
router.put('/:id/reimburse',     reimburseExpense);
export default router;
