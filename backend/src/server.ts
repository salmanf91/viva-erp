import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiLimiter } from './middleware/rateLimiter';

import authRoutes       from './routes/auth.routes';
import partnerRoutes    from './routes/partner.routes';
import partnerPersonalRoutes from './routes/partnerPersonal.routes';
import purchaseRoutes   from './routes/purchase.routes';
import expenseRoutes    from './routes/expense.routes';
import productionRoutes from './routes/production.routes';
import staffRoutes      from './routes/staff.routes';
import stockRoutes      from './routes/stock.routes';
import salesRoutes      from './routes/sales.routes';
import accessoryRoutes  from './routes/accessory.routes';
import financeRoutes    from './routes/finance.routes';
import reportRoutes     from './routes/report.routes';
import zatcaRoutes      from './routes/zatca.routes';
import tenantRoutes     from './routes/tenant.routes';
import itemRoutes       from './routes/item.routes';
import quotationRoutes  from './routes/quotation.routes';
import deliveryNoteRoutes from './routes/deliveryNote.routes';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply standard API rate limiter
app.use('/api', apiLimiter);

app.use('/api/auth',           authRoutes);
app.use('/api/tenants',        tenantRoutes);
app.use('/api/items',          itemRoutes);
app.use('/api/quotations',     quotationRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/partners/personal', partnerPersonalRoutes);
app.use('/api/partners',       partnerRoutes);
app.use('/api/purchases',      purchaseRoutes);
app.use('/api/expenses',       expenseRoutes);
app.use('/api/production',     productionRoutes);
app.use('/api/staff',          staffRoutes);
app.use('/api/stock',          stockRoutes);
app.use('/api/sales',          salesRoutes);
app.use('/api/accessories',    accessoryRoutes);
app.use('/api/finance',        financeRoutes);
app.use('/api/reports',        reportRoutes);
app.use('/api/zatca',          zatcaRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Express error handler:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

import { initDb } from './config/db';
import { initMasterDb } from './config/masterDb';

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initMasterDb();
  await initDb();
});
