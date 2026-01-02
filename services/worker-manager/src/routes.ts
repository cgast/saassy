import { Router, type Router as ExpressRouter } from 'express';
import type { Queue } from 'bullmq';
import PocketBase from 'pocketbase';
import type { DockerManager } from './docker.js';
import type { TaskJobData } from './queue.js';
import { PLAN_LIMITS, type PlanType } from '@saassy/shared';

// Validation helpers
const POCKETBASE_ID_REGEX = /^[a-z0-9]{15}$/;
const VALID_TASK_TYPES = ['example-worker', 'test-worker'];
const VALID_PLANS: PlanType[] = ['free', 'starter', 'pro', 'enterprise'];

function isValidPocketBaseId(id: string): boolean {
  return typeof id === 'string' && POCKETBASE_ID_REGEX.test(id);
}

function escapeFilterValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

// Validate required environment variables at startup
if (!INTERNAL_API_KEY || INTERNAL_API_KEY === 'dev-secret-key') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTERNAL_API_KEY must be set to a secure value in production');
  }
  console.warn('WARNING: INTERNAL_API_KEY is not set or using insecure default. Set a secure key for production.');
}

export function createRoutes(queue: Queue<TaskJobData>, docker: DockerManager): ExpressRouter {
  const router = Router();
  const pb = new PocketBase(POCKETBASE_URL);

  // Auth middleware for internal routes
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

  // POST /internal/tasks/start - Queue a task for execution
  router.post('/tasks/start', async (req, res) => {
    try {
      const { taskId, userId, type, input } = req.body;

      if (!taskId || !userId || !type || !input) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate IDs to prevent injection attacks
      if (!isValidPocketBaseId(taskId) || !isValidPocketBaseId(userId)) {
        return res.status(400).json({ error: 'Invalid task or user ID format' });
      }

      // Validate task type against whitelist
      if (!VALID_TASK_TYPES.includes(type)) {
        return res.status(400).json({ error: `Unknown task type: ${type}` });
      }

      // Get worker image for task type
      const workerImage = getWorkerImage(type);
      if (!workerImage) {
        return res.status(400).json({ error: `Unknown task type: ${type}` });
      }

      // Look up user's plan from database (don't trust client-provided plan)
      let plan: PlanType = 'free';
      try {
        const subscriptions = await pb.collection('subscriptions').getList(1, 1, {
          filter: `user = "${escapeFilterValue(userId)}" && status = "active"`,
          sort: '-created',
        });
        const subscription = subscriptions.items[0];
        if (subscription?.plan && VALID_PLANS.includes(subscription.plan)) {
          plan = subscription.plan as PlanType;
        }
      } catch (error) {
        console.warn('Could not fetch user subscription, using free plan limits:', error);
      }

      // Get limits based on verified plan
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

      // Add to queue
      const job = await queue.add(
        `task-${taskId}`,
        {
          taskId,
          userId,
          type,
          input,
          workerImage,
          limits: {
            cpuLimit: 1,
            memoryLimit: '512m',
            timeoutSeconds: limits.maxDurationSeconds,
          },
        },
        { jobId: taskId }
      );

      res.json({
        success: true,
        jobId: job.id,
        message: 'Task queued for execution',
      });
    } catch (error) {
      console.error('Failed to queue task:', error);
      res.status(500).json({ error: 'Failed to queue task' });
    }
  });

  // DELETE /internal/tasks/:id - Cancel a running task
  router.delete('/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Validate task ID
      if (!isValidPocketBaseId(id)) {
        return res.status(400).json({ error: 'Invalid task ID format' });
      }

      // Remove from queue if pending
      const job = await queue.getJob(id);
      if (job) {
        await job.remove();
      }

      // Stop container if running
      await docker.stopContainer(id);

      res.json({ success: true, message: 'Task canceled' });
    } catch (error) {
      console.error('Failed to cancel task:', error);
      res.status(500).json({ error: 'Failed to cancel task' });
    }
  });

  // GET /internal/workers/status - Get worker status
  router.get('/workers/status', async (req, res) => {
    try {
      const runningTasks = await docker.getRunningTasks();
      const queueCounts = await queue.getJobCounts();

      res.json({
        running: runningTasks.length,
        runningTasks,
        queue: {
          waiting: queueCounts.waiting,
          active: queueCounts.active,
          completed: queueCounts.completed,
          failed: queueCounts.failed,
        },
      });
    } catch (error) {
      console.error('Failed to get worker status:', error);
      res.status(500).json({ error: 'Failed to get worker status' });
    }
  });

  return router;
}

// Map task types to Docker images
function getWorkerImage(type: string): string | null {
  const workerImages: Record<string, string> = {
    'example-worker': 'saassy/example-worker:latest',
    'test-worker': 'saassy/test-worker:latest',
  };

  return workerImages[type] || null;
}
