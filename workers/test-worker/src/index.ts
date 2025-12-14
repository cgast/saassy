/**
 * Test Docker Worker for Saassy
 *
 * A comprehensive test worker that demonstrates various operation types.
 * JSON payload in -> execute -> JSON result out
 *
 * Environment variables:
 * - TASK_ID: Unique identifier for this task
 * - TASK_INPUT: JSON string containing the task input
 *
 * Operations supported:
 * - echo: Returns the input as-is (health check)
 * - math: Performs mathematical operations
 * - transform: String transformations
 * - delay: Simulates long-running tasks
 * - fail: Intentionally fails for testing error handling
 */

// Input types for different operations
interface EchoInput {
  operation: 'echo';
  data: unknown;
}

interface MathInput {
  operation: 'math';
  action: 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'factorial';
  numbers: number[];
}

interface TransformInput {
  operation: 'transform';
  action: 'uppercase' | 'lowercase' | 'reverse' | 'wordcount' | 'hash';
  text: string;
}

interface DelayInput {
  operation: 'delay';
  seconds: number;
  message?: string;
}

interface FailInput {
  operation: 'fail';
  errorMessage?: string;
  exitCode?: number;
}

type TaskInput = EchoInput | MathInput | TransformInput | DelayInput | FailInput;

interface TaskOutput {
  success: boolean;
  operation: string;
  result: unknown;
  executionTimeMs: number;
  taskId: string;
  processedAt: string;
  metadata: {
    nodeVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

async function main() {
  const startTime = Date.now();
  const taskId = process.env.TASK_ID || 'unknown';
  const inputJson = process.env.TASK_INPUT || '{}';

  console.error(`[TestWorker] Starting task: ${taskId}`);
  console.error(`[TestWorker] Input: ${inputJson}`);

  let input: TaskInput;
  try {
    input = JSON.parse(inputJson);
  } catch (error) {
    const output = createErrorOutput(taskId, startTime, 'Failed to parse TASK_INPUT as JSON');
    console.log(JSON.stringify(output));
    process.exit(1);
  }

  try {
    const result = await processOperation(input);
    const output = createSuccessOutput(taskId, startTime, input.operation, result);
    console.log(JSON.stringify(output));
    console.error(`[TestWorker] Task ${taskId} completed successfully`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const output = createErrorOutput(taskId, startTime, message);
    console.log(JSON.stringify(output));
    console.error(`[TestWorker] Task ${taskId} failed: ${message}`);

    // Use custom exit code if provided
    if (input.operation === 'fail' && (input as FailInput).exitCode) {
      process.exit((input as FailInput).exitCode);
    }
    process.exit(1);
  }
}

async function processOperation(input: TaskInput): Promise<unknown> {
  switch (input.operation) {
    case 'echo':
      return handleEcho(input);
    case 'math':
      return handleMath(input);
    case 'transform':
      return handleTransform(input);
    case 'delay':
      return handleDelay(input);
    case 'fail':
      return handleFail(input);
    default:
      throw new Error(`Unknown operation: ${(input as { operation: string }).operation}`);
  }
}

function handleEcho(input: EchoInput): unknown {
  console.error('[TestWorker] Executing echo operation');
  return {
    echoed: input.data,
    timestamp: new Date().toISOString(),
  };
}

function handleMath(input: MathInput): unknown {
  console.error(`[TestWorker] Executing math operation: ${input.action}`);
  const { action, numbers } = input;

  if (!numbers || numbers.length === 0) {
    throw new Error('Math operation requires at least one number');
  }

  let result: number;

  switch (action) {
    case 'add':
      result = numbers.reduce((sum, n) => sum + n, 0);
      break;
    case 'subtract':
      result = numbers.reduce((diff, n, i) => (i === 0 ? n : diff - n));
      break;
    case 'multiply':
      result = numbers.reduce((prod, n) => prod * n, 1);
      break;
    case 'divide':
      if (numbers.slice(1).includes(0)) {
        throw new Error('Division by zero');
      }
      result = numbers.reduce((quot, n, i) => (i === 0 ? n : quot / n));
      break;
    case 'power':
      if (numbers.length !== 2) {
        throw new Error('Power operation requires exactly 2 numbers [base, exponent]');
      }
      result = Math.pow(numbers[0]!, numbers[1]!);
      break;
    case 'factorial':
      if (numbers.length !== 1) {
        throw new Error('Factorial operation requires exactly 1 number');
      }
      result = factorial(numbers[0]!);
      break;
    default:
      throw new Error(`Unknown math action: ${action}`);
  }

  return {
    action,
    numbers,
    result,
  };
}

function factorial(n: number): number {
  if (n < 0) throw new Error('Factorial of negative number');
  if (n > 170) throw new Error('Factorial too large (max 170)');
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function handleTransform(input: TransformInput): unknown {
  console.error(`[TestWorker] Executing transform operation: ${input.action}`);
  const { action, text } = input;

  if (typeof text !== 'string') {
    throw new Error('Transform operation requires a text string');
  }

  let result: string | number;

  switch (action) {
    case 'uppercase':
      result = text.toUpperCase();
      break;
    case 'lowercase':
      result = text.toLowerCase();
      break;
    case 'reverse':
      result = text.split('').reverse().join('');
      break;
    case 'wordcount':
      result = text.trim().split(/\s+/).filter(Boolean).length;
      break;
    case 'hash':
      // Simple hash function for testing
      result = simpleHash(text);
      break;
    default:
      throw new Error(`Unknown transform action: ${action}`);
  }

  return {
    action,
    originalLength: text.length,
    result,
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

async function handleDelay(input: DelayInput): Promise<unknown> {
  const { seconds, message } = input;
  console.error(`[TestWorker] Executing delay operation: ${seconds} seconds`);

  if (seconds < 0 || seconds > 300) {
    throw new Error('Delay must be between 0 and 300 seconds');
  }

  await sleep(seconds * 1000);

  return {
    delayedSeconds: seconds,
    message: message || 'Delay completed',
    completedAt: new Date().toISOString(),
  };
}

function handleFail(input: FailInput): never {
  console.error('[TestWorker] Executing fail operation (intentional failure)');
  throw new Error(input.errorMessage || 'Intentional test failure');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSuccessOutput(
  taskId: string,
  startTime: number,
  operation: string,
  result: unknown
): TaskOutput {
  return {
    success: true,
    operation,
    result,
    executionTimeMs: Date.now() - startTime,
    taskId,
    processedAt: new Date().toISOString(),
    metadata: {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
    },
  };
}

function createErrorOutput(
  taskId: string,
  startTime: number,
  errorMessage: string
): TaskOutput {
  return {
    success: false,
    operation: 'error',
    result: { error: errorMessage },
    executionTimeMs: Date.now() - startTime,
    taskId,
    processedAt: new Date().toISOString(),
    metadata: {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
    },
  };
}

main().catch((err) => {
  console.error('[TestWorker] Unhandled error:', err);
  process.exit(1);
});
