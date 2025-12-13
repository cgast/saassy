import { Queue, QueueEvents } from 'bullmq';
import type { Task } from '@saassy/shared';

export interface TaskJobData {
  taskId: string;
  userId: string;
  type: string;
  input: Record<string, unknown>;
  workerImage: string;
  limits: {
    cpuLimit: number;
    memoryLimit: string;
    timeoutSeconds: number;
  };
}

export function createQueue(name: string, redisUrl: string) {
  const connection = { url: redisUrl };

  const queue = new Queue<TaskJobData>(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 86400, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604800, // 7 days
      },
    },
  });

  // Log queue events
  const events = new QueueEvents(name, { connection });

  events.on('completed', ({ jobId }) => {
    console.log(`Job ${jobId} completed`);
  });

  events.on('failed', ({ jobId, failedReason }) => {
    console.error(`Job ${jobId} failed: ${failedReason}`);
  });

  return queue;
}

export async function addTaskToQueue(
  queue: Queue<TaskJobData>,
  task: Task,
  workerImage: string,
  limits: TaskJobData['limits']
): Promise<string> {
  const job = await queue.add(
    `task-${task.id}`,
    {
      taskId: task.id,
      userId: task.userId,
      type: task.type,
      input: task.input,
      workerImage,
      limits,
    },
    {
      jobId: task.id,
      priority: 1,
    }
  );

  return job.id!;
}
