import { Worker, Queue } from 'bullmq';
import PocketBase from 'pocketbase';
import { DockerManager, type ContainerResult } from './docker.js';
import type { TaskJobData } from './queue.js';

// Validation helpers for defense-in-depth
const POCKETBASE_ID_REGEX = /^[a-z0-9]{15}$/;

function isValidPocketBaseId(id: string): boolean {
  return typeof id === 'string' && POCKETBASE_ID_REGEX.test(id);
}

function escapeFilterValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function createWorkerProcessor(docker: DockerManager, pocketbaseUrl: string) {
  let worker: Worker<TaskJobData> | null = null;

  const pb = new PocketBase(pocketbaseUrl);

  async function processTask(job: { data: TaskJobData }): Promise<ContainerResult> {
    const { taskId, type, input, workerImage, limits } = job.data;

    console.log(`Processing task ${taskId} (${type})`);

    // Update task status to running
    await pb.collection('tasks').update(taskId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // Run the container
    const result = await docker.runContainer({
      image: workerImage,
      taskId,
      input,
      cpuLimit: limits.cpuLimit,
      memoryLimit: limits.memoryLimit,
      timeoutSeconds: limits.timeoutSeconds,
    });

    // Update task with result
    const status = result.exitCode === 0 ? 'completed' : 'failed';
    await pb.collection('tasks').update(taskId, {
      status,
      output: tryParseJson(result.output),
      error: result.error,
      workerId: result.containerId,
      completedAt: new Date().toISOString(),
      resourceUsage: result.resourceUsage,
    });

    // Record usage for billing
    await recordUsage(pb, job.data, result);

    console.log(`Task ${taskId} ${status}`);
    return result;
  }

  async function recordUsage(
    pb: PocketBase,
    jobData: TaskJobData,
    result: ContainerResult
  ) {
    const period = new Date().toISOString().slice(0, 7); // "2024-01"

    // Validate IDs as defense-in-depth
    if (!isValidPocketBaseId(jobData.userId) || !isValidPocketBaseId(jobData.taskId)) {
      console.error('Invalid user or task ID in job data - skipping usage recording');
      return;
    }

    try {
      // Try to update existing usage record for this period
      // IDs are validated, but escape as defense-in-depth
      const existing = await pb.collection('usage_records').getList(1, 1, {
        filter: `user = "${escapeFilterValue(jobData.userId)}" && period = "${escapeFilterValue(period)}"`,
      });

      if (existing.items.length > 0) {
        const record = existing.items[0]!;
        await pb.collection('usage_records').update(record.id, {
          cpuSeconds: (record.cpuSeconds || 0) + result.resourceUsage.cpuSeconds,
          memoryMbSeconds:
            (record.memoryMbSeconds || 0) + result.resourceUsage.memoryMbSeconds,
          taskCount: (record.taskCount || 0) + 1,
        });
      } else {
        // Create new usage record
        await pb.collection('usage_records').create({
          user: jobData.userId,
          task: jobData.taskId,
          period,
          cpuSeconds: result.resourceUsage.cpuSeconds,
          memoryMbSeconds: result.resourceUsage.memoryMbSeconds,
          taskCount: 1,
          costCents: 0, // Calculated by billing service
        });
      }
    } catch (error) {
      console.error('Failed to record usage:', error);
    }
  }

  return {
    start(queue: Queue<TaskJobData>) {
      worker = new Worker<TaskJobData>(
        queue.name,
        async (job) => {
          return processTask(job);
        },
        {
          connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
          concurrency: parseInt(process.env.MAX_CONCURRENT_WORKERS || '5', 10),
        }
      );

      worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
      });

      worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err.message);
      });

      console.log('Worker processor started');
    },

    async stop() {
      if (worker) {
        await worker.close();
        worker = null;
        console.log('Worker processor stopped');
      }
    },
  };
}

function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}
