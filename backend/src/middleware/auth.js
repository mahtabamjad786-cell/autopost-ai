import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireActiveSubscription(req, res, next) {
  if (req.user.status !== 'ACTIVE') {
    return res.status(402).json({
      error: 'Your subscription is not active yet. It will be enabled once payment is confirmed by the admin.',
    });
  }
  next();
}
