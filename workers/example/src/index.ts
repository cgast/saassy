/**
 * Example Saassy Worker
 *
 * This is a template for creating worker images that run as tasks.
 *
 * Environment variables:
 * - TASK_ID: Unique identifier for this task
 * - TASK_INPUT: JSON string containing the task input
 *
 * Output:
 * - Print JSON to stdout for the result
 * - Exit code 0 = success, non-zero = failure
 */

interface TaskInput {
  message?: string;
  sleepSeconds?: number;
  shouldFail?: boolean;
}

interface TaskOutput {
  result: string;
  processedAt: string;
  input: TaskInput;
}

async function main() {
  const taskId = process.env.TASK_ID || 'unknown';
  const inputJson = process.env.TASK_INPUT || '{}';

  console.error(`[Worker] Starting task: ${taskId}`);

  let input: TaskInput;
  try {
    input = JSON.parse(inputJson);
  } catch {
    console.error('[Worker] Failed to parse TASK_INPUT');
    process.exit(1);
  }

  // Simulate some work
  const sleepSeconds = input.sleepSeconds || 1;
  console.error(`[Worker] Processing for ${sleepSeconds} seconds...`);
  await sleep(sleepSeconds * 1000);

  // Simulate failure if requested
  if (input.shouldFail) {
    console.error('[Worker] Task failed as requested');
    const output: TaskOutput = {
      result: 'error',
      processedAt: new Date().toISOString(),
      input,
    };
    console.log(JSON.stringify(output));
    process.exit(1);
  }

  // Success output
  const output: TaskOutput = {
    result: input.message ? `Processed: ${input.message}` : 'Task completed successfully',
    processedAt: new Date().toISOString(),
    input,
  };

  // Print result as JSON to stdout
  console.log(JSON.stringify(output));

  console.error(`[Worker] Task ${taskId} completed`);
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('[Worker] Unhandled error:', err);
  process.exit(1);
});
