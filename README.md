# Sentinel

A modular, distributed-ready agent framework built with TypeScript + NestJS, designed for tool-using AI systems that are safe, extensible, and production-ready.

- **Quickstart**: see [`Quickstart.md`](Quickstart.md)
- **Architecture overview**: see [`docs/architecture.md`](docs/architecture.md)

## Table of Contents

- [Quickstart](Quickstart.md)
- [Overview](#1-overview)
- [What This Project Is (and Is Not)](#2-what-this-project-is-and-is-not)
- [Core Concepts](#3-core-concepts)
- [High-Level Architecture](#4-high-level-architecture)
- [Monorepo Structure](#5-monorepo-structure)
- [Agent Execution Model](#6-agent-execution-model)
- [Tool System](#7-tool-system)
- [LLM Provider System](#8-llm-provider-system)
- [Persistence & Memory Model](#9-persistence--memory-model)
- [Distributed System Design](#10-distributed-system-design)
- [Deployment Models](#11-deployment-models)
- [Local Development](#12-local-development)
- [Docker & Compose](#13-docker--compose)
- [CLI Usage](#14-cli-usage)
- [Testing Strategy](#15-testing-strategy)
- [Security & Safety Principles](#16-security--safety-principles)
- [Extensibility Guide](#17-extensibility-guide)
- [Roadmap](#18-roadmap-high-level)
- [Contributing](#19-contributing)

## 1. Overview

Sentinel is an agent-oriented AI framework, not a chatbot.

It provides the infrastructure to build AI agents that can reason, plan, call tools, persist memory, and operate safely in production environments.

The system is designed as a distributed-ready modular monolith:

- simple to run locally
- safe and predictable
- structured so it can scale horizontally or be split into microservices later

## 2. What This Project Is (and Is Not)

### ✅ What it is

- An agent framework, not just a text generator
- Tool-calling first, with strict validation
- Provider-agnostic (OpenAI, Claude, Gemini, local models)
- Contracts-first (runtime validation + static types)
- Production-oriented (Docker, health checks, observability)
- Open-source friendly (clear module boundaries)

### ❌ What it is not

- Not an AGI
- Not a voice assistant (yet)
- Not a prompt playground
- Not a training framework
- Not a UI-first product

## 3. Core Concepts

### Agent

An agent is a system that:

- Observes input
- Reasons about intent and goals
- Plans actions (tool calls)
- Executes actions
- Reflects and responds

In this framework, LLMs are components, not the system itself.

### Tool

A tool is a deterministic, validated function the agent can call.

Examples:

- calculator
- search
- file read
- database query
- API integration

Tools are:

- schema-validated
- policy-gated
- timeout-controlled
- auditable

### Provider

A provider is an adapter to an LLM backend:

- OpenAI
- Anthropic
- Google Gemini
- Local model servers

Providers must output structured plans, not free-form text.

## 4. High-Level Architecture

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

## 5. Monorepo Structure

```
apps/
  agent-core/        # NestJS API (only Nest app)
  cli/               # CLI client
  ui/                # UI placeholder (future)

packages/
  contracts/         # Zod schemas + inferred types
  agent/             # Agent loop (planner/executor)
  tools/             # Tool interface + registry
  providers/         # LLM provider adapters
  memory/            # Persistence (Postgres/Prisma)
  observability/     # Logging, request IDs
  config/            # Typed configuration

infra/
  compose.yml        # Docker Compose
  env.example        # Example env vars
```

Important rule:

- `packages/*` must remain framework-agnostic (**no Nest imports**).

## 6. Agent Execution Model

Each `/v1/chat` request follows this flow:

1. Validate request via Zod schema
2. Load session history from memory
3. Ask provider for a structured plan
4. Validate plan schema
5. Execute tool calls (if any)
6. Persist messages + tool runs
7. Return response with trace

This is a single-turn agent by default, but designed for multi-step expansion.

## 7. Tool System

### Tool Interface

Each tool defines:

- name
- description
- argument schema
- `execute(args) → result`

### Safety Guarantees

- No arbitrary code execution
- No eval
- Timeouts enforced
- Output size capped
- Tool allowlists via policy mode

### Example Tool Categories

- math / calculation
- search
- data lookup
- internal APIs

## 8. LLM Provider System

Providers implement a common interface:

- accept prompt + context
- return structured JSON:
  - `toolCalls[]`
  - `finalResponse`
  - `trace` metadata

Supported Providers (planned/optional):

- OpenAI
- Anthropic Claude
- Google Gemini
- Local model servers (via HTTP)

Providers are config-gated:

- **no API key → provider disabled**
- **no external calls during tests**

## 9. Persistence & Memory Model

Database: Postgres

Tables:

- `sessions`
- `messages`
- `tool_runs`

All agent behavior is auditable:

- every message
- every tool call
- every tool result

This enables:

- replay
- debugging
- analytics
- compliance

## 10. Distributed System Design

This project is designed as a modular monolith that can be distributed.

Key distributed-ready principles:

- `agent-core` is stateless
- all state in shared stores
- idempotent operations
- strict contracts
- request IDs everywhere

## 11. Deployment Models

### Local Development

- Docker Compose
- single `agent-core`
- Postgres container

### Single-Host Production

- multiple `agent-core` replicas
- reverse proxy / load balancer
- shared Postgres

### Full Distributed Deployment (Kubernetes)

- `agent-core` (replicated)
- optional tool workers
- optional LLM gateway service
- managed Postgres + Redis

No code changes required to scale.

## 12. Local Development

### Install

```bash
pnpm install
```

### Start Postgres (dev)

```bash
docker compose -f infra/compose.yml up -d postgres
```

### Run API (agent-core)

`agent-core` requires `DATABASE_URL` to be set.

```bash
export DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public"
pnpm --filter agent-core start:dev
```

### Run UI (Next.js)

The UI talks to `agent-core` via `NEXT_PUBLIC_AGENT_CORE_URL` (defaults to `http://localhost:3000`).

```bash
export NEXT_PUBLIC_AGENT_CORE_URL="http://localhost:3000"
pnpm --filter ui dev
```

Then open `http://localhost:3000` (Next dev default) in your browser.

## 13. Docker & Compose

The project ships with:

- multi-stage Docker builds
- `infra/env.example`
- health endpoints for orchestration

Compose file:

- `infra/compose.yml`
  - `postgres` (dev)
  - `postgres_test` (profile `test`)
  - `agent-core` (API on `http://localhost:3000`)
  - `ui` (web on `http://localhost:3001`)

### Run with Docker Compose

```bash
docker compose -f infra/compose.yml up -d --build postgres agent-core ui
```

Open:

- UI: `http://localhost:3001`
- API health: `http://localhost:3000/health`

## 14. CLI Usage

Build and run the CLI:

```bash
pnpm --filter cli build
node apps/cli/dist/index.js health
node apps/cli/dist/index.js ask "What is 12 * (9 + 1)?"
```

Or install/run via the workspace binary after build:

```bash
pnpm --filter cli build
pnpm --filter cli start -- ask "hello"
```

The CLI is intentionally thin and stateless.

## 15. Testing Strategy

Unit tests for:

- agent logic
- tools
- providers
- contracts

E2E tests for:

- API endpoints
- persistence

No external API calls in tests.

### Running tests

```bash
pnpm test
```

### Memory integration tests (requires Docker)

```bash
pnpm --filter @sentinel/memory test:integration
```

### agent-core e2e tests (requires Docker)

```bash
pnpm --filter agent-core test:e2e
```

## 16. Security & Safety Principles

- No dangerous tools enabled by default
- Strict schema validation everywhere
- Clear separation between reasoning and execution
- Explicit policies for tool usage

## 17. Extensibility Guide

To extend the system:

- Add a new tool in `packages/tools`
- Add a provider adapter in `packages/providers`
- Add memory backends in `packages/memory`

No changes to core API required.

## 18. Roadmap (High-Level)

- Streaming responses
- Async tool execution (queue/worker)
- UI dashboard
- Plugin system
- Voice pipeline (optional)
- Multi-agent orchestration

## 19. Contributing

We welcome contributions.

Guidelines:

- follow contracts-first design
- add tests for new behavior
- do not break public schemas
- keep packages framework-agnostic
