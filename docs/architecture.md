# Sentinel Architecture

This document describes Sentinel’s architecture at a high level. The repository is organized as a **pnpm workspace** and designed as a **distributed-ready modular monolith** (easy to run locally today, easy to split into services later).

## Overview

At runtime, the system is:

- **UI / CLI** clients that talk over HTTP
- **`agent-core`** (NestJS API, stateless) that orchestrates agent execution
- **Postgres** as the system of record for sessions/messages/tool runs

## High-Level Architecture

```
          ┌───────────────┐
          │     CLI / UI  │
          └───────┬───────┘
                  │ HTTP
          ┌───────▼───────┐
          │   agent-core  │  ← NestJS API (stateless)
          │  (controllers │
          │   + services) │
          └───────┬───────┘
                  │
     ┌────────────▼────────────┐
     │        Agent Engine      │
     │  (planner + executor)   │
     └───────┬─────────┬───────┘
             │         │
     ┌───────▼───┐ ┌───▼────────┐
     │  Providers │ │   Tools    │
     └───────────┘ └────────────┘
             │
     ┌───────▼──────────┐
     │   Memory Store    │
     │   (Postgres)      │
     └───────────────────┘
```

## Monorepo layout

```
apps/
  agent-core/        # NestJS API (only Nest app)
  cli/               # CLI client
  ui/                # Next.js UI

packages/
  contracts/         # Zod schemas + inferred types (single source of truth)
  agent/             # Agent loop (planner/executor/state)
  tools/             # Tool interface + registry + builtins
  providers/         # LLM provider adapters
  memory/            # Persistence (Postgres via Prisma)
  observability/     # Request IDs, structured logging, metrics hooks
  config/            # Typed configuration (WIP)

infra/
  compose.yml        # Docker Compose (Postgres, etc.)
  env.example        # Example env vars
```

Important rule: `packages/*` must stay **framework-agnostic** (no NestJS imports).

## Execution model (current)

Each `POST /v1/chat` request is designed to follow:

1. Validate request via Zod (contracts)
2. Load session history from persistence
3. Ask provider for a structured plan
4. Validate plan schema
5. Execute tool calls (if any) safely (timeouts/limits/policy)
6. Persist messages + tool runs
7. Return `finalResponse` + trace metadata

## Persistence model

System of record: **Postgres**, managed via Prisma migrations.

Core entities (conceptually):

- sessions
- messages
- tool_runs

Everything is stored auditable (args/results as JSON).

