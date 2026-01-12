# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm (compatible with lockfile version 9.0)
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy app-specific files
COPY apps/agent-core/package.json ./apps/agent-core/
COPY apps/agent-core/tsconfig.json ./apps/agent-core/
COPY apps/agent-core/nest-cli.json ./apps/agent-core/

# Copy workspace package manifests required by agent-core
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/providers/package.json ./packages/providers/
COPY packages/providers/tsconfig.json ./packages/providers/
COPY packages/tools/package.json ./packages/tools/
COPY packages/tools/tsconfig.json ./packages/tools/
COPY packages/memory/package.json ./packages/memory/
COPY packages/memory/tsconfig.json ./packages/memory/
COPY packages/memory/prisma ./packages/memory/prisma
COPY packages/agent/package.json ./packages/agent/
COPY packages/agent/tsconfig.json ./packages/agent/

# Copy source code
COPY apps/agent-core/src ./apps/agent-core/src
COPY packages/contracts/src ./packages/contracts/src
COPY packages/providers/src ./packages/providers/src
COPY packages/tools/src ./packages/tools/src
COPY packages/memory/src ./packages/memory/src
COPY packages/agent/src ./packages/agent/src

# Install dependencies (allow build scripts for Prisma, etc.)
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Build the application
WORKDIR /app/apps/agent-core
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm (compatible with lockfile version 9.0)
RUN npm install -g pnpm@10

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy only production dependencies
COPY apps/agent-core/package.json ./apps/agent-core/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/providers/package.json ./packages/providers/
COPY packages/tools/package.json ./packages/tools/
COPY packages/memory/package.json ./packages/memory/
COPY packages/memory/prisma ./packages/memory/prisma
COPY packages/agent/package.json ./packages/agent/

# Install only production dependencies (allow build scripts for Prisma, etc.)
RUN pnpm install --prod --frozen-lockfile --dangerously-allow-all-builds

# Generate Prisma Client for runtime (required by @sentinel/memory)
RUN DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public" pnpm --filter @sentinel/memory prisma:generate

# Copy built application from builder stage
COPY --from=builder /app/apps/agent-core/dist ./apps/agent-core/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/packages/tools/dist ./packages/tools/dist
COPY --from=builder /app/packages/memory/dist ./packages/memory/dist
COPY --from=builder /app/packages/agent/dist ./packages/agent/dist

# Set working directory to app
WORKDIR /app/apps/agent-core

# Expose port
EXPOSE 3000

# Run the application
CMD ["sh", "-c", "cd /app && pnpm --filter @sentinel/memory prisma:migrate:deploy && node apps/agent-core/dist/main.js"]
