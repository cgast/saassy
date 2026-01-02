import { Router, type Router as ExpressRouter } from 'express';
import PocketBase from 'pocketbase';
import { StripeService } from './stripe.js';
import { calculateUsageSummary, formatCurrency } from './calculator.js';
import type { PlanType } from '@saassy/shared';

// Validation helpers to prevent filter injection
const POCKETBASE_ID_REGEX = /^[a-z0-9]{15}$/;
const PERIOD_REGEX = /^\d{4}-\d{2}$/;
const VALID_PLANS: PlanType[] = ['free', 'starter', 'pro', 'enterprise'];

function isValidPocketBaseId(id: string): boolean {
  return typeof id === 'string' && POCKETBASE_ID_REGEX.test(id);
}

function isValidPeriod(period: string): boolean {
  return typeof period === 'string' && PERIOD_REGEX.test(period);
}

function isValidPlan(plan: string): plan is PlanType {
  return VALID_PLANS.includes(plan as PlanType);
}

// Escape special characters in filter values as a defense-in-depth measure
function escapeFilterValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Validate required environment variables at startup
if (!INTERNAL_API_KEY || INTERNAL_API_KEY === 'dev-secret-key') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTERNAL_API_KEY must be set to a secure value in production');
  }
  console.warn('WARNING: INTERNAL_API_KEY is not set or using insecure default. Set a secure key for production.');
}

export function createRoutes(stripeService: StripeService, pocketbaseUrl: string): ExpressRouter {
  const router = Router();
  const pb = new PocketBase(pocketbaseUrl);

  // Auth middleware
  router.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    // In production, require a valid API key
    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // POST /internal/usage/record - Record usage for a task
  router.post('/usage/record', async (req, res) => {
    try {
      const { userId, taskId, resourceUsage } = req.body;

      if (!userId || !taskId || !resourceUsage) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate IDs to prevent filter injection
      if (!isValidPocketBaseId(userId) || !isValidPocketBaseId(taskId)) {
        return res.status(400).json({ error: 'Invalid user or task ID format' });
      }

      const period = new Date().toISOString().slice(0, 7);

      // Upsert usage record - IDs are validated, safe to interpolate
      const existing = await pb.collection('usage_records').getList(1, 1, {
        filter: `user = "${escapeFilterValue(userId)}" && period = "${escapeFilterValue(period)}"`,
      });

      if (existing.items.length > 0) {
        const record = existing.items[0]!;
        await pb.collection('usage_records').update(record.id, {
          cpuSeconds: (record.cpuSeconds || 0) + resourceUsage.cpuSeconds,
          memoryMbSeconds:
            (record.memoryMbSeconds || 0) + resourceUsage.memoryMbSeconds,
          taskCount: (record.taskCount || 0) + 1,
        });
      } else {
        await pb.collection('usage_records').create({
          user: userId,
          task: taskId,
          period,
          cpuSeconds: resourceUsage.cpuSeconds,
          memoryMbSeconds: resourceUsage.memoryMbSeconds,
          taskCount: 1,
          costCents: 0,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to record usage:', error);
      res.status(500).json({ error: 'Failed to record usage' });
    }
  });

  // GET /internal/usage/summary/:userId - Get usage summary for a user
  router.get('/usage/summary/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);

      // Validate inputs to prevent filter injection
      if (!isValidPocketBaseId(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      if (!isValidPeriod(period)) {
        return res.status(400).json({ error: 'Invalid period format (expected YYYY-MM)' });
      }

      // Get user's plan - IDs are validated, safe to interpolate
      const subscriptions = await pb.collection('subscriptions').getList(1, 1, {
        filter: `user = "${escapeFilterValue(userId)}"`,
        sort: '-created',
      });

      const plan: PlanType = subscriptions.items[0]?.plan || 'free';

      // Get usage records for period
      const usageRecords = await pb.collection('usage_records').getList(1, 100, {
        filter: `user = "${escapeFilterValue(userId)}" && period = "${escapeFilterValue(period)}"`,
      });

      const summary = calculateUsageSummary(
        plan,
        usageRecords.items.map((r) => ({
          cpuSeconds: r.cpuSeconds || 0,
          memoryMbSeconds: r.memoryMbSeconds || 0,
          taskCount: r.taskCount || 0,
        }))
      );

      res.json({
        success: true,
        data: {
          ...summary,
          plan,
          formattedTotal: formatCurrency(summary.totalCostCents),
        },
      });
    } catch (error) {
      console.error('Failed to get usage summary:', error);
      res.status(500).json({ error: 'Failed to get usage summary' });
    }
  });

  // POST /internal/checkout - Create Stripe checkout session
  router.post('/checkout', async (req, res) => {
    try {
      const { userId, plan, successUrl, cancelUrl } = req.body;

      if (!userId || !plan || !successUrl || !cancelUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate inputs
      if (!isValidPocketBaseId(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      if (!isValidPlan(plan)) {
        return res.status(400).json({ error: 'Invalid plan type' });
      }

      // Get or create Stripe customer
      const user = await pb.collection('users').getOne(userId);
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        customerId = await stripeService.createCustomer(userId, user.email, user.name);
        await pb.collection('users').update(userId, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const checkoutUrl = await stripeService.createCheckoutSession(
        customerId,
        plan,
        successUrl,
        cancelUrl
      );

      res.json({ success: true, url: checkoutUrl });
    } catch (error) {
      console.error('Failed to create checkout:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // POST /internal/portal - Create Stripe billing portal session
  router.post('/portal', async (req, res) => {
    try {
      const { userId, returnUrl } = req.body;

      if (!userId || !returnUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate user ID
      if (!isValidPocketBaseId(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const user = await pb.collection('users').getOne(userId);

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: 'User has no Stripe customer ID' });
      }

      const portalUrl = await stripeService.createPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      res.json({ success: true, url: portalUrl });
    } catch (error) {
      console.error('Failed to create portal session:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  return router;
}
