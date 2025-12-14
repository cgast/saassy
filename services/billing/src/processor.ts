import { Worker } from 'bullmq';
import PocketBase from 'pocketbase';
import { StripeService } from './stripe.js';
import { calculateResourceCost } from './calculator.js';
import { QUEUE_NAMES } from '@saassy/shared';

interface UsageEvent {
  userId: string;
  taskId: string;
  resourceUsage: {
    cpuSeconds: number;
    memoryMbSeconds: number;
    durationSeconds: number;
  };
}

export function createBillingProcessor(
  stripeService: StripeService,
  pocketbaseUrl: string,
  redisUrl: string
) {
  let worker: Worker<UsageEvent> | null = null;
  const pb = new PocketBase(pocketbaseUrl);

  async function processUsageEvent(job: { data: UsageEvent }) {
    const { userId, taskId, resourceUsage } = job.data;

    console.log(`Processing usage for task ${taskId}`);

    try {
      // Get user's subscription
      const subscriptions = await pb.collection('subscriptions').getList(1, 1, {
        filter: `user = "${userId}" && status = "active"`,
      });

      if (subscriptions.items.length === 0) {
        console.log(`No active subscription for user ${userId}`);
        return;
      }

      const subscription = subscriptions.items[0]!;

      // Calculate cost for this task
      const costCents = calculateResourceCost(resourceUsage);

      // Update usage record
      const period = new Date().toISOString().slice(0, 7);
      const existingRecords = await pb.collection('usage_records').getList(1, 1, {
        filter: `user = "${userId}" && period = "${period}"`,
      });

      if (existingRecords.items.length > 0) {
        const record = existingRecords.items[0]!;
        await pb.collection('usage_records').update(record.id, {
          costCents: (record.costCents || 0) + costCents,
        });
      }

      // If subscription has metered billing, report to Stripe
      if (subscription.stripeSubscriptionId) {
        try {
          const stripeSub = await stripeService.getSubscription(
            subscription.stripeSubscriptionId
          );

          // Find metered price item
          const meteredItem = stripeSub.items.data.find(
            (item) => item.price.recurring?.usage_type === 'metered'
          );

          if (meteredItem) {
            // Report task count as usage
            await stripeService.reportUsage(meteredItem.id, 1);
          }
        } catch (error) {
          console.error('Failed to report usage to Stripe:', error);
        }
      }

      console.log(`Recorded ${costCents} cents for task ${taskId}`);
    } catch (error) {
      console.error('Failed to process usage event:', error);
      throw error;
    }
  }

  return {
    start() {
      worker = new Worker<UsageEvent>(
        QUEUE_NAMES.billing,
        async (job) => {
          await processUsageEvent(job);
        },
        {
          connection: { url: redisUrl },
          concurrency: 10,
        }
      );

      worker.on('completed', (job) => {
        console.log(`Billing job ${job.id} completed`);
      });

      worker.on('failed', (job, err) => {
        console.error(`Billing job ${job?.id} failed:`, err.message);
      });

      console.log('Billing processor started');
    },

    async stop() {
      if (worker) {
        await worker.close();
        worker = null;
        console.log('Billing processor stopped');
      }
    },
  };
}
