/**
 * Local test runner for Test Worker
 * Run with: npm test
 *
 * Tests the worker logic directly without Docker
 */

interface TestCase {
  name: string;
  input: Record<string, unknown>;
  expectedSuccess: boolean;
  validate: (output: unknown) => boolean;
}

const testCases: TestCase[] = [
  // Echo tests
  {
    name: 'Echo: simple object',
    input: { operation: 'echo', data: { hello: 'world' } },
    expectedSuccess: true,
    validate: (output: any) => output.result?.echoed?.hello === 'world',
  },
  {
    name: 'Echo: array data',
    input: { operation: 'echo', data: [1, 2, 3] },
    expectedSuccess: true,
    validate: (output: any) => Array.isArray(output.result?.echoed) && output.result.echoed.length === 3,
  },

  // Math tests
  {
    name: 'Math: add numbers',
    input: { operation: 'math', action: 'add', numbers: [1, 2, 3, 4, 5] },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 15,
  },
  {
    name: 'Math: multiply numbers',
    input: { operation: 'math', action: 'multiply', numbers: [2, 3, 4] },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 24,
  },
  {
    name: 'Math: divide numbers',
    input: { operation: 'math', action: 'divide', numbers: [100, 2, 5] },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 10,
  },
  {
    name: 'Math: power',
    input: { operation: 'math', action: 'power', numbers: [2, 10] },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 1024,
  },
  {
    name: 'Math: factorial',
    input: { operation: 'math', action: 'factorial', numbers: [5] },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 120,
  },
  {
    name: 'Math: divide by zero (error)',
    input: { operation: 'math', action: 'divide', numbers: [10, 0] },
    expectedSuccess: false,
    validate: (output: any) => output.result?.error?.includes('zero'),
  },

  // Transform tests
  {
    name: 'Transform: uppercase',
    input: { operation: 'transform', action: 'uppercase', text: 'hello world' },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 'HELLO WORLD',
  },
  {
    name: 'Transform: lowercase',
    input: { operation: 'transform', action: 'lowercase', text: 'HELLO WORLD' },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 'hello world',
  },
  {
    name: 'Transform: reverse',
    input: { operation: 'transform', action: 'reverse', text: 'hello' },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 'olleh',
  },
  {
    name: 'Transform: wordcount',
    input: { operation: 'transform', action: 'wordcount', text: 'one two three four five' },
    expectedSuccess: true,
    validate: (output: any) => output.result?.result === 5,
  },
  {
    name: 'Transform: hash',
    input: { operation: 'transform', action: 'hash', text: 'test string' },
    expectedSuccess: true,
    validate: (output: any) => typeof output.result?.result === 'string' && output.result.result.length === 8,
  },

  // Delay test (short delay for testing)
  {
    name: 'Delay: 1 second',
    input: { operation: 'delay', seconds: 1, message: 'Test delay' },
    expectedSuccess: true,
    validate: (output: any) => output.result?.delayedSeconds === 1 && output.result?.message === 'Test delay',
  },

  // Fail tests
  {
    name: 'Fail: intentional error',
    input: { operation: 'fail', errorMessage: 'Test error message' },
    expectedSuccess: false,
    validate: (output: any) => output.result?.error === 'Test error message',
  },

  // Unknown operation
  {
    name: 'Unknown: operation not found',
    input: { operation: 'unknown' },
    expectedSuccess: false,
    validate: (output: any) => output.result?.error?.includes('Unknown operation'),
  },
];

async function runTest(testCase: TestCase): Promise<{ passed: boolean; message: string }> {
  const startTime = Date.now();

  // Simulate environment
  process.env.TASK_ID = `test-${Date.now()}`;
  process.env.TASK_INPUT = JSON.stringify(testCase.input);

  // Dynamically import and execute worker logic
  // We'll simulate the worker by processing the input directly

  let output: any;
  try {
    output = await processTestInput(testCase.input);
  } catch (error) {
    return {
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const elapsed = Date.now() - startTime;

  // Check success status
  if (output.success !== testCase.expectedSuccess) {
    return {
      passed: false,
      message: `Expected success=${testCase.expectedSuccess}, got ${output.success}`,
    };
  }

  // Validate output
  if (!testCase.validate(output)) {
    return {
      passed: false,
      message: `Validation failed. Output: ${JSON.stringify(output.result)}`,
    };
  }

  return {
    passed: true,
    message: `Passed in ${elapsed}ms`,
  };
}

// Simplified worker logic for testing without process.exit
async function processTestInput(input: any): Promise<any> {
  const taskId = 'test';
  const startTime = Date.now();

  try {
    const result = await processOperation(input);
    return {
      success: true,
      operation: input.operation,
      result,
      executionTimeMs: Date.now() - startTime,
      taskId,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      operation: input.operation || 'error',
      result: { error: error instanceof Error ? error.message : 'Unknown error' },
      executionTimeMs: Date.now() - startTime,
      taskId,
      processedAt: new Date().toISOString(),
    };
  }
}

async function processOperation(input: any): Promise<unknown> {
  switch (input.operation) {
    case 'echo':
      return { echoed: input.data, timestamp: new Date().toISOString() };

    case 'math': {
      const { action, numbers } = input;
      if (!numbers || numbers.length === 0) {
        throw new Error('Math operation requires at least one number');
      }
      let result: number;
      switch (action) {
        case 'add':
          result = numbers.reduce((sum: number, n: number) => sum + n, 0);
          break;
        case 'subtract':
          result = numbers.reduce((diff: number, n: number, i: number) => (i === 0 ? n : diff - n));
          break;
        case 'multiply':
          result = numbers.reduce((prod: number, n: number) => prod * n, 1);
          break;
        case 'divide':
          if (numbers.slice(1).includes(0)) throw new Error('Division by zero');
          result = numbers.reduce((quot: number, n: number, i: number) => (i === 0 ? n : quot / n));
          break;
        case 'power':
          if (numbers.length !== 2) throw new Error('Power operation requires exactly 2 numbers');
          result = Math.pow(numbers[0], numbers[1]);
          break;
        case 'factorial': {
          if (numbers.length !== 1) throw new Error('Factorial requires exactly 1 number');
          const n = numbers[0];
          if (n < 0) throw new Error('Factorial of negative number');
          if (n === 0 || n === 1) result = 1;
          else {
            result = 1;
            for (let i = 2; i <= n; i++) result *= i;
          }
          break;
        }
        default:
          throw new Error(`Unknown math action: ${action}`);
      }
      return { action, numbers, result };
    }

    case 'transform': {
      const { action, text } = input;
      if (typeof text !== 'string') throw new Error('Transform requires a text string');
      let result: string | number;
      switch (action) {
        case 'uppercase': result = text.toUpperCase(); break;
        case 'lowercase': result = text.toLowerCase(); break;
        case 'reverse': result = text.split('').reverse().join(''); break;
        case 'wordcount': result = text.trim().split(/\s+/).filter(Boolean).length; break;
        case 'hash': {
          let hash = 0;
          for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          result = Math.abs(hash).toString(16).padStart(8, '0');
          break;
        }
        default:
          throw new Error(`Unknown transform action: ${action}`);
      }
      return { action, originalLength: text.length, result };
    }

    case 'delay': {
      const { seconds, message } = input;
      if (seconds < 0 || seconds > 300) throw new Error('Delay must be between 0 and 300 seconds');
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return { delayedSeconds: seconds, message: message || 'Delay completed', completedAt: new Date().toISOString() };
    }

    case 'fail':
      throw new Error(input.errorMessage || 'Intentional test failure');

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  SAASSY TEST WORKER - Unit Tests');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result.passed) {
      console.log(`✓ ${testCase.name} - ${result.message}`);
      passed++;
    } else {
      console.log(`✗ ${testCase.name} - ${result.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
