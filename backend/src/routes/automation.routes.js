import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireActiveSubscription } from '../middleware/auth.js';

const router = Router();
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// GET /api/automation
router.get('/', requireAuth, async (req, res) => {
  const automation = await prisma.automation.findUnique({ where: { userId: req.user.id } });
  res.json({
    automation: automation
      ? {
          ...automation,
          postingTimes: JSON.parse(automation.postingTimes || '[]'),
          activePageIds: JSON.parse(automation.activePageIds || '[]'),
          subtopicHistory: JSON.parse(automation.subtopicHistory || '[]'),
        }
      : null,
  });
});

// PUT /api/automation  { topic, language, tone, postingTimes: [], activePageIds: [] }
router.put('/', requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { topic, language, tone, postingTimes, activePageIds } = req.body;
    if (!topic || !Array.isArray(postingTimes) || postingTimes.length === 0) {
      return res.status(400).json({ error: 'topic and at least one posting time are required' });
    }
    if (postingTimes.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 posting times per day' });
    }
    if (!postingTimes.every((t) => TIME_RE.test(t))) {
      return res.status(400).json({ error: 'Posting times must be in HH:MM 24-hour format' });
    }

    const plan = req.user.planId ? await prisma.plan.findUnique({ where: { id: req.user.planId } }) : null;
    if (plan && postingTimes.length > plan.maxPostsPerDay) {
      return res.status(403).json({ error: `Your plan allows a maximum of ${plan.maxPostsPerDay} post(s) daily` });
    }
    if (plan && activePageIds?.length > plan.maxPages) {
      return res.status(403).json({ error: `Your plan allows a maximum of ${plan.maxPages} Facebook Page(s)` });
    }

    const automation = await prisma.automation.upsert({
      where: { userId: req.user.id },
      update: {
        topic,
        language: language || 'English',
        tone: tone || 'Professional',
        postingTimes: JSON.stringify(postingTimes),
        activePageIds: JSON.stringify(activePageIds || []),
      },
      create: {
        userId: req.user.id,
        topic,
        language: language || 'English',
        tone: tone || 'Professional',
        postingTimes: JSON.stringify(postingTimes),
        activePageIds: JSON.stringify(activePageIds || []),
      },
    });

    res.json({ automation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/start
router.post('/start', requireAuth, requireActiveSubscription, async (req, res) => {
  const automation = await prisma.automation.findUnique({ where: { userId: req.user.id } });
  if (!automation) return res.status(400).json({ error: 'Configure your automation first' });
  if (JSON.parse(automation.activePageIds || '[]').length === 0) {
    return res.status(400).json({ error: 'Connect and select at least one Facebook Page first' });
  }

  const updated = await prisma.automation.update({
    where: { userId: req.user.id },
    data: { isActive: true },
  });
  await prisma.activityLog.create({
    data: { userId: req.user.id, action: 'AUTOMATION_STARTED', detail: automation.topic },
  });
  res.json({ automation: updated });
});

// POST /api/automation/stop
router.post('/stop', requireAuth, async (req, res) => {
  const updated = await prisma.automation.update({
    where: { userId: req.user.id },
    data: { isActive: false },
  });
  await prisma.activityLog.create({ data: { userId: req.user.id, action: 'AUTOMATION_STOPPED' } });
  res.json({ automation: updated });
});

// GET /api/automation/posts  — history for the logged-in user
router.get('/posts', requireAuth, async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { userId: req.user.id },
    include: { facebookPage: true },
    orderBy: { scheduledFor: 'desc' },
    take: 50,
  });
  res.json({ posts });
});

export default router;
