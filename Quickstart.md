# Sentinel Quickstart

This guide is intended to get you running locally as quickly as possible.

- **Full project README**: [`README.md`](README.md)
- **Architecture overview**: [`docs/architecture.md`](docs/architecture.md)

## Prerequisites

- **Node.js**: 18+ (20+ recommended)
- **pnpm**: 8+ (10+ recommended)
  - If you don’t have pnpm: enable corepack and install pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

- **Docker**: Docker Desktop / Docker Engine + Docker Compose v2 (required for the default dev workflow)

## Clone

```bash
git clone https://github.com/JerrySJoseph/Sentinel.git
cd Sentinel
```

## Install dependencies

```bash
pnpm install
```

## Configure environment

The dev scripts will look for `infra/.env` first, and fall back to `infra/env.example`.

Create your local env file:

```bash
cp infra/env.example infra/.env
```

Defaults work out of the box (Postgres user/password/db all `sentinel`).

## Run everything (one command)

This will:

- start Postgres via Docker Compose
- run Prisma generate + migrations
- start `agent-core` (API) on `http://localhost:3000`
- start `ui` on `http://localhost:3001`

```bash
pnpm dev
```

Stop the running processes with `Ctrl+C`.

To stop Docker containers:

```bash
pnpm down
```

## Verify it’s running

- **API health**: `http://localhost:3000/health`
- **UI**: `http://localhost:3001`

You can also verify via CLI:

```bash
pnpm --filter cli build
node apps/cli/dist/index.js health
```

## Use the UI

Open `http://localhost:3001`, type a message, and you should see an agent response. The UI calls the API using `NEXT_PUBLIC_AGENT_CORE_URL` (defaults to `http://localhost:3000` in dev).

## Use the CLI

```bash
pnpm --filter cli build
node apps/cli/dist/index.js ask "What is 12 * (9 + 1)?"
```

## Run tests

Runs tests across `apps/*` and `packages/*`:

```bash
pnpm test
```

## Troubleshooting

### Ports already in use

Default ports:

- API: `3000`
- UI: `3001`
- Postgres: `5432`

If a port is in use:

- stop existing processes using that port, or
- stop compose containers: `pnpm down`

### Docker issues

- Ensure Docker is running (`docker ps` works)
- If you have a stuck stack:

```bash
pnpm down --remove-orphans
```

### Prisma / migrations issues

If you see migration errors in dev:

- Confirm Postgres is reachable on `localhost:5432`
- Re-run migrations manually:

```bash
DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public" pnpm --filter @sentinel/memory prisma:migrate:deploy
```

If you need a clean local database (destructive):

```bash
DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel?schema=public" pnpm --filter @sentinel/memory prisma:migrate:reset
```

### `pnpm up` confusion

`pnpm up` is a pnpm built-in (“update dependencies”). For Docker Compose via pnpm scripts, use:

- `pnpm run up` / `pnpm run compose:up`
- `pnpm down` / `pnpm run compose:down`

