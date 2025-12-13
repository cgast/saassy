# Example Saassy Worker
# This is a template for creating worker images

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

# Run as non-root user
RUN addgroup -S worker && adduser -S worker -G worker
USER worker

# The entrypoint runs the worker
CMD ["node", "dist/index.js"]
