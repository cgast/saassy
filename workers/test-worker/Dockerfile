# Test Worker for Saassy
# A comprehensive test worker demonstrating JSON in/out pattern

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Copy only what's needed
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Run as non-root user for security
RUN addgroup -S worker && adduser -S worker -G worker
USER worker

# Labels for identification
LABEL org.opencontainers.image.title="Saassy Test Worker"
LABEL org.opencontainers.image.description="Test Docker worker for Saassy demonstrating JSON in/out operations"
LABEL org.opencontainers.image.vendor="Saassy"
LABEL saassy.worker.type="test-worker"
LABEL saassy.worker.version="0.1.0"

# The entrypoint runs the worker
CMD ["node", "dist/index.js"]
