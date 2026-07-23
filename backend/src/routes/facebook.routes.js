import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const FB_VERSION = process.env.FB_GRAPH_VERSION || 'v20.0';
const GRAPH = `https://graph.facebook.com/${FB_VERSION}`;

// GET /api/facebook/login-url
// Frontend redirects the browser here to start Facebook Login.
router.get('/login-url', requireAuth, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.FB_APP_ID,
    redirect_uri: process.env.FB_REDIRECT_URI,
    scope: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
      'business_management',
    ].join(','),
    state: req.user.id, // carry our user id through the OAuth round-trip
    response_type: 'code',
  });
  res.json({ url: `https://www.facebook.com/${FB_VERSION}/dialog/oauth?${params}` });
});

// GET /api/facebook/callback  (Facebook redirects here after user approves)
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.status(400).send('Missing code or state');

    // 1. Exchange code for a short-lived user access token
    const tokenRes = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: process.env.FB_REDIRECT_URI,
        code,
      },
    });
    const shortLivedToken = tokenRes.data.access_token;

    // 2. Exchange for a long-lived user access token (~60 days)
    const longRes = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    const longLivedUserToken = longRes.data.access_token;

    // Stash it temporarily; the user picks which Page(s) to connect next.
    // (For a real deployment, store this in a short-lived server-side cache
    // keyed by userId instead of a query param, to avoid leaking tokens in URLs/logs.)
    res.redirect(
      `${process.env.FRONTEND_URL}/connect-facebook?userToken=${encodeURIComponent(longLivedUserToken)}`
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/connect-facebook?error=1`);
  }
});

// GET /api/facebook/pages?userToken=...
// List the Facebook Pages the logged-in FB user manages, so they can pick which to connect.
router.get('/pages', requireAuth, async (req, res) => {
  try {
    const { userToken } = req.query;
    if (!userToken) return res.status(400).json({ error: 'userToken is required' });

    const { data } = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: userToken },
    });

    const pages = data.data.map((p) => ({
      pageId: p.id,
      name: p.name,
      accessToken: p.access_token, // page access token, does not expire like user tokens
    }));
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/facebook/connect  { pageId, name, accessToken }
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const { pageId, name, accessToken } = req.body;
    const plan = req.user.planId
      ? await prisma.plan.findUnique({ where: { id: req.user.planId } })
      : null;

    const existingCount = await prisma.facebookPage.count({ where: { userId: req.user.id } });
    if (plan && existingCount >= plan.maxPages) {
      return res.status(403).json({ error: `Your plan allows a maximum of ${plan.maxPages} Facebook Page(s).` });
    }

    const page = await prisma.facebookPage.upsert({
      where: { pageId },
      update: { accessToken, pageName: name },
      create: { pageId, pageName: name, accessToken, userId: req.user.id },
    });

    res.status(201).json({ page });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/facebook/connected
router.get('/connected', requireAuth, async (req, res) => {
  const pages = await prisma.facebookPage.findMany({ where: { userId: req.user.id } });
  res.json({ pages });
});

// DELETE /api/facebook/:pageDbId
router.delete('/:pageDbId', requireAuth, async (req, res) => {
  await prisma.facebookPage.deleteMany({
    where: { id: req.params.pageDbId, userId: req.user.id },
  });
  res.json({ ok: true });
});

export default router;
