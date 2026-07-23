import { Router } from 'express';

const router = Router();

// POST /api/webhooks/stripe
// Per the spec, activation is MANUAL by default (admin confirms payment and
// flips the account to ACTIVE in the Admin Panel — see admin.routes.js).
// This endpoint is a ready-made hook if you later want Stripe (or JazzCash/
// Easypaisa's server callback) to auto-activate instead. Wire up signature
// verification with your provider's SDK before using in production.
router.post('/stripe', async (req, res) => {
  console.log('[webhook] Received payment event (not yet wired to auto-activation):', req.body?.type);
  res.status(200).json({ received: true });
});

export default router;
