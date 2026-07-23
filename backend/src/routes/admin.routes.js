import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ---------- Dashboard ----------
// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalUsers, activeUsers, scheduledToday, published, failed, activePlans] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
    prisma.post.count({ where: { scheduledFor: { gte: startOfDay } } }),
    prisma.post.count({ where: { status: 'PUBLISHED', scheduledFor: { gte: startOfDay } } }),
    prisma.post.count({ where: { status: 'FAILED', scheduledFor: { gte: startOfDay } } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } }),
  ]);

  const revenue = activePlans.reduce((sum, u) => sum + (u.plan?.priceMonthly || 0), 0);

  res.json({
    totalUsers,
    activeUsers,
    scheduledToday,
    published,
    failed,
    revenue,
  });
});

// ---------- User management ----------
// GET /api/admin/users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    include: { plan: true, _count: { select: { posts: true, facebookPages: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

// POST /api/admin/users/:id/activate
router.post('/users/:id/activate', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'ACTIVE' } });
  await prisma.activityLog.create({ data: { userId: user.id, action: 'ADMIN_ACTIVATED' } });
  res.json({ user });
});

// POST /api/admin/users/:id/suspend
router.post('/users/:id/suspend', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
  // Suspending also pauses their automation so nothing posts while suspended.
  await prisma.automation.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  await prisma.activityLog.create({ data: { userId: user.id, action: 'ADMIN_SUSPENDED' } });
  res.json({ user });
});

// POST /api/admin/users/:id/plan  { planId }
router.post('/users/:id/plan', async (req, res) => {
  const { planId } = req.body;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { planId } });
  await prisma.activityLog.create({ data: { userId: user.id, action: 'ADMIN_PLAN_CHANGED', detail: planId } });
  res.json({ user });
});

// POST /api/admin/users/:id/reset-api  (clears connected FB pages, forcing reconnect)
router.post('/users/:id/reset-api', async (req, res) => {
  await prisma.facebookPage.deleteMany({ where: { userId: req.params.id } });
  await prisma.activityLog.create({ data: { userId: req.params.id, action: 'ADMIN_RESET_API' } });
  res.json({ ok: true });
});

// GET /api/admin/users/:id/activity
router.get('/users/:id/activity', async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ logs });
});

// ---------- Plans ----------
// GET /api/admin/plans
router.get('/plans', async (req, res) => {
  const plans = await prisma.plan.findMany();
  res.json({ plans });
});

// POST /api/admin/plans  { name, maxPages, maxPostsPerDay, aiTier, priceMonthly }
router.post('/plans', async (req, res) => {
  const plan = await prisma.plan.create({ data: req.body });
  res.status(201).json({ plan });
});

// PUT /api/admin/plans/:id
router.put('/plans/:id', async (req, res) => {
  const plan = await prisma.plan.update({ where: { id: req.params.id }, data: req.body });
  res.json({ plan });
});

// ---------- AI API provider management ----------
// GET /api/admin/api-keys
router.get('/api-keys', async (req, res) => {
  const keys = await prisma.apiKey.findMany();
  // Never send the raw key back to the browser — just whether it's set.
  res.json({
    keys: keys.map((k) => ({ id: k.id, provider: k.provider, isActive: k.isActive, hasKey: !!k.keyValue })),
  });
});

// PUT /api/admin/api-keys  { provider, keyValue, isActive }
router.put('/api-keys', async (req, res) => {
  const { provider, keyValue, isActive } = req.body;
  const key = await prisma.apiKey.upsert({
    where: { provider },
    update: { keyValue, isActive: isActive ?? true },
    create: { provider, keyValue, isActive: isActive ?? true },
  });
  res.json({ key: { id: key.id, provider: key.provider, isActive: key.isActive, hasKey: !!key.keyValue } });
});

// ---------- Global settings ----------
// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  let settings = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.adminSettings.create({ data: { id: 1 } });
  res.json({ settings });
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  const settings = await prisma.adminSettings.upsert({
    where: { id: 1 },
    update: req.body,
    create: { id: 1, ...req.body },
  });
  res.json({ settings });
});

// ---------- Posts (global view across all users) ----------
// GET /api/admin/posts?status=FAILED
router.get('/posts', async (req, res) => {
  const { status } = req.query;
  const posts = await prisma.post.findMany({
    where: status ? { status } : {},
    include: { user: { select: { name: true, email: true } }, facebookPage: true },
    orderBy: { scheduledFor: 'desc' },
    take: 100,
  });
  res.json({ posts });
});

export default router;
