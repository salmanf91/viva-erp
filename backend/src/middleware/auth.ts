import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { tenantStorage } from '../config/db';

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    req.user = payload;
    
    // Resolve tenant database context
    const dbName = payload.dbName || (payload.tenantSlug ? `erp_tenant_${payload.tenantSlug}` : (process.env.DB_NAME || 'viva_erp'));
    
    tenantStorage.run({
      tenantId: payload.tenantId,
      dbName,
      slug: payload.tenantSlug
    }, () => {
      next();
    });
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin && req.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'Access denied: Super Admin privileges required.' });
    return;
  }
  next();
}
