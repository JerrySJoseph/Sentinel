##
# Multi-stage build for apps/ui (Next.js).
#
# - Uses pnpm workspaces from repo root context.
# - Produces a minimal runtime image via Next "standalone" output.
##

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
# Copy workspace package manifests and sources so pnpm sees the full workspace graph
# (avoid wildcard destination paths like packages/*/package.json which create literal "*" dirs).
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_AGENT_CORE_URL=http://localhost:3000
ENV NEXT_PUBLIC_AGENT_CORE_URL=$NEXT_PUBLIC_AGENT_CORE_URL
RUN pnpm --filter ui build
# Ensure expected standalone entry exists (monorepo layout)
RUN test -f apps/ui/.next/standalone/apps/ui/server.js

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Copy the full standalone output (includes a root node_modules used by symlinks in apps/ui/node_modules)
COPY --from=builder /repo/apps/ui/.next/standalone ./
# Static assets are NOT included in standalone by default
COPY --from=builder /repo/apps/ui/.next/static ./apps/ui/.next/static
COPY --from=builder /repo/apps/ui/public ./apps/ui/public

EXPOSE 3000
WORKDIR /app/apps/ui
CMD ["node", "server.js"]


