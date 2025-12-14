# Docker Workers Guide

A comprehensive guide for developers and LLMs on transforming existing projects into Docker-based workers for the SaaSsy platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Worker Architecture](#worker-architecture)
4. [Step-by-Step Transformation](#step-by-step-transformation)
5. [Dockerfile Patterns](#dockerfile-patterns)
6. [Input/Output Conventions](#inputoutput-conventions)
7. [Configuration & Environment](#configuration--environment)
8. [Testing Your Worker](#testing-your-worker)
9. [Production Checklist](#production-checklist)
10. [Troubleshooting](#troubleshooting)
11. [Examples](#examples)
12. [LLM Prompting Guide](#llm-prompting-guide)

---

## Overview

### What is a Docker Worker?

A Docker worker is a containerized application that:
- Receives task input via environment variables
- Processes the task independently
- Outputs results to stdout as JSON
- Uses exit codes to indicate success/failure

### Why Docker Workers?

| Benefit | Description |
|---------|-------------|
| **Isolation** | Each task runs in its own container with resource limits |
| **Scalability** | Easily scale by running more containers |
| **Consistency** | Same environment in dev, test, and production |
| **Security** | Sandboxed execution with non-root users |
| **Language Agnostic** | Any language that can run in a container |

---

## Quick Start

### Minimum Viable Worker (Node.js)

```typescript
// src/index.ts
const taskId = process.env.TASK_ID || 'unknown';
const taskInput = process.env.TASK_INPUT || '{}';

try {
  const input = JSON.parse(taskInput);

  // Your processing logic here
  const result = processTask(input);

  // Output JSON to stdout
  console.log(JSON.stringify({
    success: true,
    result,
    taskId,
    processedAt: new Date().toISOString()
  }));

  process.exit(0);
} catch (error) {
  console.log(JSON.stringify({
    success: false,
    error: error.message,
    taskId
  }));
  process.exit(1);
}
```

### Minimum Viable Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
USER node
CMD ["node", "dist/index.js"]
```

---

## Worker Architecture

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Worker Manager                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Queue     │───▶│  Processor  │───▶│   Docker Manager    │  │
│  │  (BullMQ)   │    │             │    │                     │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
└──────────────────────────────────────────────────┬──────────────┘
                                                   │
                    ┌──────────────────────────────▼──────────────┐
                    │             Docker Container                 │
                    │  ┌────────────────────────────────────────┐ │
                    │  │  Environment Variables:                 │ │
                    │  │    TASK_ID=abc123                       │ │
                    │  │    TASK_INPUT={"operation":"..."}       │ │
                    │  └────────────────────────────────────────┘ │
                    │                     │                        │
                    │                     ▼                        │
                    │  ┌────────────────────────────────────────┐ │
                    │  │           Your Worker Code              │ │
                    │  │         (Any Language/Runtime)          │ │
                    │  └────────────────────────────────────────┘ │
                    │                     │                        │
                    │          ┌──────────┴──────────┐            │
                    │          ▼                     ▼            │
                    │       stdout               exit code        │
                    │    (JSON result)          (0=success)       │
                    └─────────────────────────────────────────────┘
```

### Standard Interface

| Component | Description |
|-----------|-------------|
| **Input** | `TASK_INPUT` environment variable (JSON string) |
| **Task ID** | `TASK_ID` environment variable (unique identifier) |
| **Output** | JSON to stdout (single line, last line is parsed) |
| **Logs** | stderr for debugging/logging (not parsed) |
| **Status** | Exit code: 0 = success, non-zero = failure |

---

## Step-by-Step Transformation

### Step 1: Analyze Your Existing Project

Before transforming, answer these questions:

```markdown
## Project Analysis Checklist

- [ ] What does the project do? (core functionality)
- [ ] What are the inputs? (files, API calls, data)
- [ ] What are the outputs? (files, data, side effects)
- [ ] What runtime/language is used?
- [ ] What dependencies are required?
- [ ] Are there external service dependencies? (databases, APIs)
- [ ] What resources does it need? (CPU, memory, disk)
- [ ] How long do tasks typically run?
- [ ] Are there any secrets/credentials needed?
```

### Step 2: Define the Task Interface

Design your input/output schema:

```typescript
// Define your input type
interface TaskInput {
  operation: string;      // What operation to perform
  data: unknown;          // Operation-specific data
  options?: {             // Optional configuration
    timeout?: number;
    retries?: number;
  };
}

// Define your output type
interface TaskOutput {
  success: boolean;
  operation: string;
  result: unknown;
  executionTimeMs: number;
  taskId: string;
  processedAt: string;
  metadata?: {
    version: string;
    [key: string]: unknown;
  };
}
```

### Step 3: Refactor for CLI Execution

Transform your code to:
1. Read input from environment variables
2. Execute as a single run (no server/daemon)
3. Output JSON to stdout
4. Exit with appropriate code

**Before (Server-based):**
```typescript
// Express server handling requests
app.post('/process', async (req, res) => {
  const result = await processData(req.body);
  res.json(result);
});
```

**After (Worker):**
```typescript
// Standalone execution
async function main() {
  const input = JSON.parse(process.env.TASK_INPUT || '{}');
  const result = await processData(input);
  console.log(JSON.stringify({ success: true, result }));
  process.exit(0);
}
main().catch(err => {
  console.log(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
```

### Step 4: Create the Dockerfile

See [Dockerfile Patterns](#dockerfile-patterns) for language-specific templates.

### Step 5: Test Locally

```bash
# Build the image
docker build -t my-worker:latest .

# Run a test task
docker run --rm \
  -e TASK_ID="test-001" \
  -e TASK_INPUT='{"operation":"test","data":"hello"}' \
  my-worker:latest

# Expected output: {"success":true,"result":...}
```

### Step 6: Integrate with Platform

Register your worker image and configure resource limits.

---

## Dockerfile Patterns

### Node.js/TypeScript (Recommended)

```dockerfile
# ===========================
# Stage 1: Builder
# ===========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ===========================
# Stage 2: Production
# ===========================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S worker && \
    adduser -S worker -u 1001 -G worker

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Set ownership and switch to non-root user
RUN chown -R worker:worker /app
USER worker

# Labels for identification
LABEL saassy.worker.type="my-worker"
LABEL saassy.worker.version="1.0.0"

# Run the worker
CMD ["node", "dist/index.js"]
```

### Python

```dockerfile
# ===========================
# Stage 1: Builder
# ===========================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ===========================
# Stage 2: Production
# ===========================
FROM python:3.12-slim AS production

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 worker && \
    useradd -u 1001 -g worker -s /bin/false worker

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY src/ ./src/

# Set ownership
RUN chown -R worker:worker /app
USER worker

LABEL saassy.worker.type="python-worker"
LABEL saassy.worker.version="1.0.0"

CMD ["python", "src/main.py"]
```

### Go

```dockerfile
# ===========================
# Stage 1: Builder
# ===========================
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o worker ./cmd/worker

# ===========================
# Stage 2: Production
# ===========================
FROM alpine:3.19 AS production

WORKDIR /app

# Add ca-certificates for HTTPS and create non-root user
RUN apk --no-cache add ca-certificates && \
    addgroup -g 1001 -S worker && \
    adduser -S worker -u 1001 -G worker

# Copy binary from builder
COPY --from=builder /app/worker .

USER worker

LABEL saassy.worker.type="go-worker"
LABEL saassy.worker.version="1.0.0"

CMD ["./worker"]
```

### Rust

```dockerfile
# ===========================
# Stage 1: Builder
# ===========================
FROM rust:1.75-slim AS builder

WORKDIR /app

# Create dummy project to cache dependencies
RUN cargo new --bin worker
WORKDIR /app/worker
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release && rm -rf src

# Build actual application
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ===========================
# Stage 2: Production
# ===========================
FROM debian:bookworm-slim AS production

WORKDIR /app

RUN groupadd -g 1001 worker && \
    useradd -u 1001 -g worker -s /bin/false worker

COPY --from=builder /app/worker/target/release/worker .

USER worker

LABEL saassy.worker.type="rust-worker"
LABEL saassy.worker.version="1.0.0"

CMD ["./worker"]
```

### Generic Shell Script

```dockerfile
FROM alpine:3.19

WORKDIR /app

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    jq

# Create non-root user
RUN addgroup -g 1001 -S worker && \
    adduser -S worker -u 1001 -G worker

COPY scripts/ ./scripts/
RUN chmod +x ./scripts/*.sh && \
    chown -R worker:worker /app

USER worker

LABEL saassy.worker.type="shell-worker"
LABEL saassy.worker.version="1.0.0"

CMD ["./scripts/worker.sh"]
```

---

## Input/Output Conventions

### Input Format

Workers receive input via the `TASK_INPUT` environment variable as a JSON string:

```json
{
  "operation": "process_image",
  "data": {
    "url": "https://example.com/image.jpg",
    "transformations": ["resize", "crop"]
  },
  "config": {
    "width": 800,
    "height": 600,
    "quality": 85
  }
}
```

### Output Format (Success)

```json
{
  "success": true,
  "operation": "process_image",
  "result": {
    "processedUrl": "https://cdn.example.com/processed/abc123.jpg",
    "dimensions": { "width": 800, "height": 600 },
    "fileSize": 125430
  },
  "executionTimeMs": 1523,
  "taskId": "task_abc123",
  "processedAt": "2024-01-15T10:30:45.123Z",
  "metadata": {
    "workerVersion": "1.0.0",
    "memoryUsedMb": 128
  }
}
```

### Output Format (Failure)

```json
{
  "success": false,
  "operation": "process_image",
  "error": "Invalid image format: expected JPEG or PNG",
  "errorCode": "INVALID_FORMAT",
  "taskId": "task_abc123",
  "processedAt": "2024-01-15T10:30:45.123Z",
  "metadata": {
    "workerVersion": "1.0.0",
    "inputUrl": "https://example.com/file.gif"
  }
}
```

### Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | Task completed successfully |
| 1 | General failure | Unhandled exception |
| 2 | Invalid input | Malformed JSON, missing required fields |
| 3 | Timeout | Task exceeded allowed time |
| 4 | Resource limit | Out of memory, disk full |
| 5+ | Custom codes | Application-specific errors |

### Logging Best Practices

```typescript
// Use stderr for logs (not parsed as result)
const log = (level: string, message: string, data?: object) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  console.error(JSON.stringify(entry));
};

// Examples
log('info', 'Starting task processing', { taskId });
log('debug', 'Processing step complete', { step: 1, duration: 500 });
log('warn', 'Retrying failed operation', { attempt: 2, maxAttempts: 3 });
log('error', 'Operation failed', { error: err.message, stack: err.stack });
```

---

## Configuration & Environment

### Standard Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TASK_ID` | Unique task identifier | `task_abc123xyz` |
| `TASK_INPUT` | JSON-encoded task input | `{"operation":"..."} ` |
| `NODE_ENV` | Runtime environment | `production` |

### Custom Environment Variables

Pass additional configuration via the task submission:

```typescript
// Task submission
{
  "workerImage": "mycompany/image-processor:v1.2.0",
  "input": { "operation": "resize", "url": "..." },
  "env": {
    "AWS_REGION": "us-east-1",
    "S3_BUCKET": "processed-images",
    "MAX_FILE_SIZE": "10485760"
  },
  "resources": {
    "cpuLimit": 2,
    "memoryLimit": "1g",
    "timeoutSeconds": 300
  }
}
```

### Secrets Management

**Never hardcode secrets in your Docker image!**

Options for handling secrets:
1. Pass via environment variables at runtime
2. Use Docker secrets (for Swarm mode)
3. Fetch from a secrets manager at startup

```typescript
// Fetch secrets at startup
async function getSecrets() {
  // Option 1: Environment variable
  const apiKey = process.env.API_KEY;

  // Option 2: Secrets manager (AWS Secrets Manager example)
  const secret = await secretsManager.getSecretValue({
    SecretId: process.env.SECRET_ARN
  }).promise();

  return JSON.parse(secret.SecretString);
}
```

---

## Testing Your Worker

### Local Testing

```bash
#!/bin/bash
# test-worker.sh

IMAGE="my-worker:latest"

# Test 1: Basic operation
echo "Test 1: Basic operation"
OUTPUT=$(docker run --rm \
  -e TASK_ID="test-001" \
  -e TASK_INPUT='{"operation":"echo","data":"hello"}' \
  "$IMAGE")

if echo "$OUTPUT" | jq -e '.success == true' > /dev/null; then
  echo "✓ PASSED"
else
  echo "✗ FAILED"
  echo "Output: $OUTPUT"
fi

# Test 2: Error handling
echo "Test 2: Error handling"
OUTPUT=$(docker run --rm \
  -e TASK_ID="test-002" \
  -e TASK_INPUT='invalid json' \
  "$IMAGE" 2>&1) || true

if echo "$OUTPUT" | jq -e '.success == false' > /dev/null; then
  echo "✓ PASSED"
else
  echo "✗ FAILED"
fi

# Test 3: Resource limits
echo "Test 3: Memory limit"
docker run --rm \
  --memory=256m \
  --cpus=0.5 \
  -e TASK_ID="test-003" \
  -e TASK_INPUT='{"operation":"heavy"}' \
  "$IMAGE"
```

### Integration Testing

Create a `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  test-runner:
    image: node:20-alpine
    volumes:
      - ./tests:/tests
      - /var/run/docker.sock:/var/run/docker.sock
    command: sh -c "apk add --no-cache docker-cli bash jq && bash /tests/integration.sh"
    depends_on:
      worker-build:
        condition: service_completed_successfully

  worker-build:
    image: docker:24-cli
    volumes:
      - .:/workspace
      - /var/run/docker.sock:/var/run/docker.sock
    working_dir: /workspace
    command: docker build -t my-worker:test .
```

### Unit Testing (Node.js Example)

```typescript
// src/test.ts
import { processTask, TaskInput, TaskOutput } from './processor';

interface TestCase {
  name: string;
  input: TaskInput;
  expectedSuccess: boolean;
  validate: (output: TaskOutput) => boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Echo operation returns input',
    input: { operation: 'echo', data: { message: 'hello' } },
    expectedSuccess: true,
    validate: (output) => output.result.message === 'hello'
  },
  {
    name: 'Invalid operation fails gracefully',
    input: { operation: 'invalid' as any, data: {} },
    expectedSuccess: false,
    validate: (output) => output.error?.includes('Unknown operation')
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    try {
      const output = await processTask(test.input);
      const success = output.success === test.expectedSuccess && test.validate(output);

      if (success) {
        console.log(`✓ ${test.name}`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);
        console.log(`  Expected success=${test.expectedSuccess}, got=${output.success}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name} (threw exception)`);
      console.log(`  Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

---

## Production Checklist

### Security

- [ ] **Non-root user**: Container runs as non-root user
- [ ] **No secrets in image**: Secrets passed at runtime
- [ ] **Minimal base image**: Alpine or distroless
- [ ] **No unnecessary packages**: Only required dependencies
- [ ] **Input validation**: Sanitize and validate all inputs
- [ ] **Resource limits**: Enforce CPU and memory limits
- [ ] **Network isolation**: Worker network is isolated

### Reliability

- [ ] **Health checks**: Dockerfile includes HEALTHCHECK (if applicable)
- [ ] **Graceful shutdown**: Handle SIGTERM properly
- [ ] **Timeout handling**: Worker respects timeout limits
- [ ] **Error handling**: All errors produce valid JSON output
- [ ] **Exit codes**: Appropriate exit codes for different failures
- [ ] **Idempotency**: Safe to retry failed tasks

### Observability

- [ ] **Structured logging**: JSON logs to stderr
- [ ] **Metadata in output**: Version, timing, resource usage
- [ ] **Task ID tracking**: Include task ID in all logs/outputs

### Performance

- [ ] **Multi-stage build**: Minimal production image
- [ ] **Layer caching**: Dependencies before code
- [ ] **Small image size**: Under 500MB preferred
- [ ] **Fast startup**: Minimize initialization time

### Documentation

- [ ] **README**: Usage instructions and examples
- [ ] **Input schema**: Document expected input format
- [ ] **Output schema**: Document output format
- [ ] **Environment variables**: List all supported env vars
- [ ] **Resource requirements**: Document CPU/memory needs

---

## Troubleshooting

### Common Issues

#### 1. JSON Parse Error on Output

**Symptom**: Worker manager can't parse worker output

**Causes**:
- Multiple JSON objects printed
- Debug logs mixed with output
- Encoding issues

**Solution**:
```typescript
// Ensure only ONE JSON line is output
// Use stderr for all logs
console.error('Debug info');  // Goes to stderr (logs)
console.log(JSON.stringify(result));  // Goes to stdout (parsed)
```

#### 2. Container Exits Immediately

**Symptom**: Container starts and stops without processing

**Causes**:
- Missing TASK_INPUT
- Crash on startup

**Debug**:
```bash
# Run interactively
docker run -it --rm \
  -e TASK_ID="debug" \
  -e TASK_INPUT='{"test":true}' \
  my-worker:latest /bin/sh

# Check if node/python is working
node --version
```

#### 3. Out of Memory

**Symptom**: Container killed with exit code 137

**Causes**:
- Memory limit too low
- Memory leak in worker

**Solution**:
```yaml
# Increase memory limit
resources:
  memoryLimit: "1g"  # Increase from 512m
```

#### 4. Network Timeout

**Symptom**: External API calls fail

**Causes**:
- Worker network doesn't have internet access
- DNS resolution failing

**Solution**:
```yaml
# Ensure network has external access
networks:
  saassy-workers:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

#### 5. Permission Denied

**Symptom**: Can't write to files or directories

**Causes**:
- Running as non-root (correct!)
- Volume not writable

**Solution**:
```dockerfile
# Create writable directory
RUN mkdir -p /app/tmp && chown worker:worker /app/tmp
WORKDIR /app/tmp
```

### Debugging Commands

```bash
# View container logs
docker logs <container_id>

# Inspect container
docker inspect <container_id>

# Run with shell for debugging
docker run -it --rm --entrypoint /bin/sh my-worker:latest

# Check resource usage
docker stats <container_id>

# View network connectivity
docker run --rm --network saassy-workers alpine ping -c 3 google.com
```

---

## Examples

### Example 1: Image Processing Worker

```typescript
// src/index.ts
import sharp from 'sharp';

interface ImageTask {
  operation: 'resize' | 'crop' | 'convert';
  imageUrl: string;
  options: {
    width?: number;
    height?: number;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  };
}

async function processImage(input: ImageTask) {
  const response = await fetch(input.imageUrl);
  const buffer = await response.arrayBuffer();

  let image = sharp(Buffer.from(buffer));

  switch (input.operation) {
    case 'resize':
      image = image.resize(input.options.width, input.options.height);
      break;
    case 'crop':
      image = image.extract({
        left: 0, top: 0,
        width: input.options.width!,
        height: input.options.height!
      });
      break;
    case 'convert':
      image = image.toFormat(input.options.format!, {
        quality: input.options.quality || 80
      });
      break;
  }

  const outputBuffer = await image.toBuffer();
  const metadata = await image.metadata();

  return {
    base64: outputBuffer.toString('base64'),
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    size: outputBuffer.length
  };
}

// Main execution
(async () => {
  const taskId = process.env.TASK_ID || 'unknown';
  const startTime = Date.now();

  try {
    const input: ImageTask = JSON.parse(process.env.TASK_INPUT || '{}');
    const result = await processImage(input);

    console.log(JSON.stringify({
      success: true,
      operation: input.operation,
      result,
      executionTimeMs: Date.now() - startTime,
      taskId,
      processedAt: new Date().toISOString()
    }));
    process.exit(0);
  } catch (error: any) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      taskId,
      processedAt: new Date().toISOString()
    }));
    process.exit(1);
  }
})();
```

### Example 2: Data Processing Worker (Python)

```python
#!/usr/bin/env python3
# src/main.py

import json
import os
import sys
import time
from datetime import datetime
import pandas as pd

def process_task(input_data: dict) -> dict:
    operation = input_data.get('operation')
    data = input_data.get('data', [])

    if operation == 'aggregate':
        df = pd.DataFrame(data)
        result = {
            'count': len(df),
            'sum': df.select_dtypes(include='number').sum().to_dict(),
            'mean': df.select_dtypes(include='number').mean().to_dict()
        }
    elif operation == 'filter':
        df = pd.DataFrame(data)
        conditions = input_data.get('conditions', {})
        for col, value in conditions.items():
            df = df[df[col] == value]
        result = df.to_dict(orient='records')
    elif operation == 'transform':
        df = pd.DataFrame(data)
        transformations = input_data.get('transformations', [])
        for t in transformations:
            if t['type'] == 'rename':
                df = df.rename(columns=t['mapping'])
            elif t['type'] == 'drop':
                df = df.drop(columns=t['columns'])
        result = df.to_dict(orient='records')
    else:
        raise ValueError(f"Unknown operation: {operation}")

    return result

def main():
    task_id = os.environ.get('TASK_ID', 'unknown')
    task_input = os.environ.get('TASK_INPUT', '{}')
    start_time = time.time()

    try:
        input_data = json.loads(task_input)
        result = process_task(input_data)

        output = {
            'success': True,
            'operation': input_data.get('operation'),
            'result': result,
            'executionTimeMs': int((time.time() - start_time) * 1000),
            'taskId': task_id,
            'processedAt': datetime.utcnow().isoformat() + 'Z'
        }
        print(json.dumps(output))
        sys.exit(0)

    except Exception as e:
        output = {
            'success': False,
            'error': str(e),
            'taskId': task_id,
            'processedAt': datetime.utcnow().isoformat() + 'Z'
        }
        print(json.dumps(output))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Example 3: CLI Tool Wrapper

```bash
#!/bin/bash
# scripts/worker.sh - Wrapping ffmpeg as a worker

set -e

TASK_ID="${TASK_ID:-unknown}"
TASK_INPUT="${TASK_INPUT:-{}}"
START_TIME=$(date +%s%N)

# Parse input
OPERATION=$(echo "$TASK_INPUT" | jq -r '.operation')
INPUT_URL=$(echo "$TASK_INPUT" | jq -r '.inputUrl')
OUTPUT_FORMAT=$(echo "$TASK_INPUT" | jq -r '.outputFormat // "mp4"')

# Create temp directory
WORK_DIR=$(mktemp -d)
trap "rm -rf $WORK_DIR" EXIT

# Download input file
INPUT_FILE="$WORK_DIR/input"
curl -sL "$INPUT_URL" -o "$INPUT_FILE"

# Process based on operation
OUTPUT_FILE="$WORK_DIR/output.$OUTPUT_FORMAT"

case "$OPERATION" in
  "convert")
    ffmpeg -i "$INPUT_FILE" -y "$OUTPUT_FILE" 2>/dev/null
    ;;
  "compress")
    QUALITY=$(echo "$TASK_INPUT" | jq -r '.quality // 23')
    ffmpeg -i "$INPUT_FILE" -crf "$QUALITY" -y "$OUTPUT_FILE" 2>/dev/null
    ;;
  "extract_audio")
    ffmpeg -i "$INPUT_FILE" -vn -acodec copy -y "$OUTPUT_FILE" 2>/dev/null
    ;;
  *)
    echo "{\"success\":false,\"error\":\"Unknown operation: $OPERATION\",\"taskId\":\"$TASK_ID\"}"
    exit 1
    ;;
esac

# Calculate execution time
END_TIME=$(date +%s%N)
EXEC_TIME_MS=$(( (END_TIME - START_TIME) / 1000000 ))

# Get output file info
FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE")
OUTPUT_BASE64=$(base64 < "$OUTPUT_FILE")

# Output result
cat <<EOF
{
  "success": true,
  "operation": "$OPERATION",
  "result": {
    "base64": "$OUTPUT_BASE64",
    "format": "$OUTPUT_FORMAT",
    "size": $FILE_SIZE
  },
  "executionTimeMs": $EXEC_TIME_MS,
  "taskId": "$TASK_ID",
  "processedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
```

---

## LLM Prompting Guide

Use these prompts when asking an LLM to help transform your project into a Docker worker.

### Initial Analysis Prompt

```markdown
I need to transform my existing project into a Docker worker for a SaaS platform.

**My project:**
- Language/runtime: [e.g., Node.js/TypeScript, Python, Go]
- What it does: [describe core functionality]
- Current execution model: [e.g., REST API, CLI tool, library]
- Dependencies: [list major dependencies]
- Typical input: [describe input format/source]
- Typical output: [describe output format]
- Resource needs: [CPU/memory estimates]

**Docker worker requirements:**
- Input via TASK_INPUT environment variable (JSON string)
- Output to stdout as single-line JSON
- Exit code 0 for success, non-zero for failure
- Must run as non-root user
- Should be a multi-stage Dockerfile for minimal image size

Please analyze my project and provide:
1. A transformation plan
2. Any challenges or considerations
3. Suggested input/output schema
```

### Dockerfile Generation Prompt

```markdown
Create a production-ready Dockerfile for my [LANGUAGE] worker with these requirements:

1. Multi-stage build (builder + production stages)
2. Non-root user for security
3. Minimal final image size
4. Dependencies cached in separate layer
5. Labels for identification:
   - saassy.worker.type="[worker-name]"
   - saassy.worker.version="[version]"

My project structure:
```
[paste directory structure]
```

Build commands needed:
- [e.g., npm ci, pip install, go build]
- [e.g., npm run build, python -m compileall]

Entry point: [e.g., node dist/index.js, python src/main.py]
```

### Code Transformation Prompt

```markdown
Transform my existing code to work as a Docker worker.

**Current code:**
```[language]
[paste current code]
```

**Requirements:**
1. Read input from process.env.TASK_INPUT (JSON string)
2. Read task ID from process.env.TASK_ID
3. Output result to stdout as JSON with this structure:
   ```json
   {
     "success": boolean,
     "operation": string,
     "result": any,
     "executionTimeMs": number,
     "taskId": string,
     "processedAt": string (ISO 8601)
   }
   ```
4. Use stderr for logging (console.error or equivalent)
5. Exit with code 0 on success, non-zero on failure
6. Handle errors gracefully - always output valid JSON

Please provide the transformed code with:
- TypeScript interfaces/types for input and output (if applicable)
- Error handling
- Execution timing
- Proper exit codes
```

### Testing Prompt

```markdown
Create a comprehensive test suite for my Docker worker.

**Worker image:** [image name]

**Operations supported:**
1. [operation name]: [description, expected input/output]
2. [operation name]: [description, expected input/output]

**Test requirements:**
1. Shell script for integration testing (using docker run)
2. Test success cases for each operation
3. Test error handling (invalid input, edge cases)
4. Test resource limits (timeout, memory)
5. Validate JSON output format using jq

Output format for tests:
- Print ✓ for passed tests
- Print ✗ for failed tests with details
- Exit with non-zero if any tests fail
```

### Debugging Prompt

```markdown
My Docker worker is failing with this issue:

**Symptom:** [describe what's happening]

**Error output:**
```
[paste error message or logs]
```

**My Dockerfile:**
```dockerfile
[paste Dockerfile]
```

**My worker code:**
```[language]
[paste relevant code]
```

**Command I'm running:**
```bash
[paste docker command]
```

Please help me:
1. Identify the root cause
2. Suggest a fix
3. Explain why this happened
4. Provide best practices to prevent this
```

---

## Quick Reference Card

### Worker Interface

| Component | Type | Description |
|-----------|------|-------------|
| `TASK_ID` | env var | Unique task identifier |
| `TASK_INPUT` | env var | JSON-encoded input |
| stdout | JSON | Single-line result object |
| stderr | any | Logs (not parsed) |
| exit code | int | 0=success, >0=failure |

### Output Schema

```typescript
{
  success: boolean;      // Required
  result?: any;          // On success
  error?: string;        // On failure
  operation?: string;    // What was done
  executionTimeMs: number;
  taskId: string;
  processedAt: string;   // ISO 8601
}
```

### Dockerfile Checklist

```dockerfile
# 1. Multi-stage build
FROM base AS builder
FROM base AS production

# 2. Non-root user
RUN adduser -S worker
USER worker

# 3. Labels
LABEL saassy.worker.type="name"
LABEL saassy.worker.version="1.0.0"

# 4. Entry point
CMD ["node", "dist/index.js"]
```

### Test Command

```bash
docker run --rm \
  -e TASK_ID="test" \
  -e TASK_INPUT='{"operation":"test"}' \
  my-worker:latest
```

---

## Resources

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [12-Factor App](https://12factor.net/)
- [OCI Image Spec](https://github.com/opencontainers/image-spec)

---

*This guide is part of the SaaSsy platform documentation. For questions or contributions, please open an issue in the repository.*
