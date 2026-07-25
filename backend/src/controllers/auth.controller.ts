import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { User } from '../types';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, tenant_id } = req.body;
  if (!email || !password || !tenant_id) {
    res.status(400).json({ message: 'email, password and tenant_id are required' });
    return;
  }
  try {
    const rows = await query<any[]>(
      `SELECT u.*, t.name AS tenant_name
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = ? AND u.tenant_id = ? LIMIT 1`,
      [email, tenant_id]
    );
    if (!rows.length) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );
    res.json({
      token,
      id: user.id, name: user.name, email: user.email,
      role: user.role, tenant_id: user.tenant_id, tenant_name: user.tenant_name,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function getTenants(_req: Request, res: Response): Promise<void> {
  try {
    const tenants = await query<{ id: number; name: string }[]>('SELECT id, name FROM tenants ORDER BY name');
    res.json(tenants);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { userId } = (req as any).user;
  const { current_password, new_password } = req.body;
  try {
    const rows = await query<User[]>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) { res.status(404).json({ message: 'User not found' }); return; }
    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) { res.status(401).json({ message: 'Current password incorrect' }); return; }
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    res.json({ message: 'Password updated' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
}
