import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes       from './routes/auth.routes';
import partnerRoutes    from './routes/partner.routes';
import purchaseRoutes   from './routes/purchase.routes';
import expenseRoutes    from './routes/expense.routes';
import productionRoutes from './routes/production.routes';
import staffRoutes      from './routes/staff.routes';
import stockRoutes      from './routes/stock.routes';
import salesRoutes      from './routes/sales.routes';
import accessoryRoutes  from './routes/accessory.routes';
import financeRoutes    from './routes/finance.routes';
import reportRoutes     from './routes/report.routes';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/partners',    partnerRoutes);
app.use('/api/purchases',   purchaseRoutes);
app.use('/api/expenses',    expenseRoutes);
app.use('/api/production',  productionRoutes);
app.use('/api/staff',       staffRoutes);
app.use('/api/stock',       stockRoutes);
app.use('/api/sales',       salesRoutes);
app.use('/api/accessories', accessoryRoutes);
app.use('/api/finance',     financeRoutes);
app.use('/api/reports',     reportRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
