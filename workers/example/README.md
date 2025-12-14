# Example Worker

This is a template for creating Saassy workers. Workers are Docker containers that execute tasks.

## How Workers Work

1. The worker receives task input via the `TASK_INPUT` environment variable (JSON string)
2. The worker processes the task
3. The worker outputs the result as JSON to stdout
4. Exit code 0 = success, non-zero = failure

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TASK_ID` | Unique identifier for this task |
| `TASK_INPUT` | JSON string containing task input |

## Creating Your Own Worker

1. Copy this directory as a template
2. Modify `src/index.ts` with your logic
3. Update `Dockerfile` if you need additional dependencies
4. Build and push your image:

```bash
# Build
docker build -t your-registry/your-worker:latest .

# Push
docker push your-registry/your-worker:latest
```

5. Register the worker type in the worker-manager service

## Input/Output Format

### Input

The worker receives input as a JSON string in `TASK_INPUT`. Parse it in your code:

```typescript
const input = JSON.parse(process.env.TASK_INPUT || '{}');
```

### Output

Print the result as JSON to stdout:

```typescript
console.log(JSON.stringify({ result: 'your result' }));
```

Use `console.error()` for logs that shouldn't be part of the result.

## Testing Locally

```bash
# Build the image
npm run docker:build

# Run with test input
docker run --rm \
  -e TASK_ID=test-123 \
  -e TASK_INPUT='{"message":"Hello World"}' \
  saassy/example-worker:latest
```

## Best Practices

1. **Keep images small**: Use Alpine base images, multi-stage builds
2. **Handle errors gracefully**: Always exit with non-zero on failure
3. **Log to stderr**: Use `console.error()` for logs, `console.log()` for output
4. **Set timeouts**: Don't let tasks run forever
5. **Be stateless**: Don't rely on persistent storage
