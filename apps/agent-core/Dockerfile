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

# Copy source code
COPY apps/agent-core/src ./apps/agent-core/src
COPY packages/contracts/src ./packages/contracts/src

# Install dependencies
RUN pnpm install --frozen-lockfile

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

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/agent-core/dist ./apps/agent-core/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist

# Set working directory to app
WORKDIR /app/apps/agent-core

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "dist/main.js"]
