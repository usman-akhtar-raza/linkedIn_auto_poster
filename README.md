# AI LinkedIn Content Agent

Production-oriented monorepo for an AI agent that researches topics, drafts LinkedIn posts, supports image prompts, approval workflows, scheduling, publishing, and analytics.

## Apps

- `frontend/`: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui.
- `backend/`: NestJS, Prisma, PostgreSQL, BullMQ, Redis, Swagger.

## Local Setup

1. Copy `.env.example` to `.env` and `backend/.env.example` to `backend/.env`.
2. Start infrastructure:

```bash
docker compose up -d postgres redis
```

3. Prepare the backend database:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

4. Start the frontend:

```bash
cd frontend
npm run dev
```

## Architecture

The backend uses module boundaries that map to the product domains:

- `auth`, `users`
- `ai`, `prompts`, `memory`, `topics`
- `posts`, `approval`, `linkedin`, `analytics`
- `scheduler`, `queue`, `jobs`, `images`

Each feature module is split into `application`, `domain`, `infrastructure`, and `presentation` folders so future channels such as X, Instagram, Threads, RAG, and MCP integrations can be added without rewriting the core workflow.
