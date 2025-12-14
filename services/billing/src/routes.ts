import { Router } from 'express';
import PocketBase from 'pocketbase';
import { StripeService } from './stripe.js';
import { calculateUsageSummary, formatCurrency } from './calculator.js';
import type { PlanType } from '@saassy/shared';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-secret-key';

export function createRoutes(stripeService: StripeService, pocketbaseUrl: string) {
  const router = Router();
  const pb = new PocketBase(pocketbaseUrl);

  // Auth middleware
  router.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
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

      const period = new Date().toISOString().slice(0, 7);

      // Upsert usage record
      const existing = await pb.collection('usage_records').getList(1, 1, {
        filter: `user = "${userId}" && period = "${period}"`,
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
      const period = req.query.period as string || new Date().toISOString().slice(0, 7);

      // Get user's plan
      const subscriptions = await pb.collection('subscriptions').getList(1, 1, {
        filter: `user = "${userId}"`,
        sort: '-created',
      });

      const plan: PlanType = subscriptions.items[0]?.plan || 'free';

      // Get usage records for period
      const usageRecords = await pb.collection('usage_records').getList(1, 100, {
        filter: `user = "${userId}" && period = "${period}"`,
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
