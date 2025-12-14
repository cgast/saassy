# Saassy Test Worker

A comprehensive test Docker worker for Saassy that demonstrates the JSON input/output pattern with multiple operations.

## Operations

The test worker supports the following operations:

### Echo
Returns the input data as-is. Useful for health checks and testing connectivity.

```json
{
  "operation": "echo",
  "data": { "any": "data" }
}
```

### Math
Performs mathematical operations on arrays of numbers.

```json
{
  "operation": "math",
  "action": "add|subtract|multiply|divide|power|factorial",
  "numbers": [1, 2, 3]
}
```

Supported actions:
- `add` - Sum all numbers
- `subtract` - Subtract subsequent numbers from the first
- `multiply` - Multiply all numbers
- `divide` - Divide the first number by subsequent numbers
- `power` - Requires exactly 2 numbers [base, exponent]
- `factorial` - Requires exactly 1 number

### Transform
String transformation operations.

```json
{
  "operation": "transform",
  "action": "uppercase|lowercase|reverse|wordcount|hash",
  "text": "hello world"
}
```

### Delay
Simulates a long-running task.

```json
{
  "operation": "delay",
  "seconds": 5,
  "message": "Optional message"
}
```

### Fail
Intentionally fails for testing error handling.

```json
{
  "operation": "fail",
  "errorMessage": "Custom error message",
  "exitCode": 1
}
```

## Output Format

All operations return a JSON response:

```json
{
  "success": true,
  "operation": "math",
  "result": { ... },
  "executionTimeMs": 42,
  "taskId": "task-123",
  "processedAt": "2024-01-15T12:00:00.000Z",
  "metadata": {
    "nodeVersion": "v20.10.0",
    "memoryUsage": { ... }
  }
}
```

## Usage

### Build Docker Image

```bash
# From the test-worker directory
npm install
npm run docker:build

# Or from the project root
npm run test:worker:build
```

### Run Locally (without Docker)

```bash
# Unit tests
npm test

# Direct execution
TASK_INPUT='{"operation":"echo","data":"hello"}' npm run dev
```

### Run with Docker

```bash
# Echo test
npm run docker:run

# Math test
npm run docker:run:math

# Transform test
npm run docker:run:transform

# Delay test
npm run docker:run:delay

# Fail test (expected to fail)
npm run docker:run:fail
```

### Run Integration Tests

```bash
# From project root - Docker isolation tests
./tests/test-worker.sh

# End-to-end API tests (requires services running)
./tests/e2e-test-worker.sh
```

## Integration with Saassy

The test worker is registered as `test-worker` type in the worker manager. To use it via the API:

```bash
# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test-worker",
    "input": {
      "operation": "math",
      "action": "add",
      "numbers": [1, 2, 3]
    }
  }'
```

## User Account Features

When tasks are executed:
1. **Execution tracking** - Task status visible in dashboard (pending → running → completed/failed)
2. **Result storage** - Output JSON stored in the task record
3. **Accounting** - Resource usage (CPU-seconds, memory-MB-seconds) tracked per user per month
4. **Billing** - Usage counted against plan limits, costs calculated automatically
