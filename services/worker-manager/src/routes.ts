import { Router } from 'express';
import type { Queue } from 'bullmq';
import type { DockerManager } from './docker.js';
import type { TaskJobData } from './queue.js';
import { PLAN_LIMITS, type PlanType } from '@saassy/shared';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-secret-key';

export function createRoutes(queue: Queue<TaskJobData>, docker: DockerManager) {
  const router = Router();

  // Auth middleware for internal routes
  router.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });

  // POST /internal/tasks/start - Queue a task for execution
  router.post('/tasks/start', async (req, res) => {
    try {
      const { taskId, userId, type, input, plan = 'free' } = req.body;

      if (!taskId || !userId || !type || !input) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get worker image for task type
      const workerImage = getWorkerImage(type);
      if (!workerImage) {
        return res.status(400).json({ error: `Unknown task type: ${type}` });
      }

      // Get limits based on plan
      const limits = PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.free;

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
