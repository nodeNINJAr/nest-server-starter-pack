# NestJS Starter Pack

A production-ready NestJS backend starter with authentication, background jobs,
file uploads, and deploy tooling already wired together — so a new project starts
from a working foundation instead of an empty `nest new`.

## What's included

- **NestJS 11** + **TypeScript**, global `/api/v1` prefix, Swagger docs, class-validator DTOs
- **Prisma 7** + **PostgreSQL** (via `@prisma/adapter-pg`), migrations + seed script
- **JWT auth** with role guards — `@Public()`, `@Auth()`, `@RoleChecker()`, `@CurrentUser()` decorators
- **Redis** client (`RedisService`) and **BullMQ** queues for email, SMS, and push notifications, with worker processors already built
- Transactional email via **Nodemailer** + Handlebars templates (welcome, OTP, password reset, verification, announcement)
- SMS via **Twilio**
- Push notifications via **Firebase Cloud Messaging** (optional — the app boots fine without it configured)
- File uploads to **S3** (via `multer-s3`)
- Global exception filter + Prisma exception filter, uniform API response shape
- **Docker** (multi-stage prod build + dev compose) and a sample **Caddy** reverse-proxy config

A minimal `auth` module (register/login/me) and `upload` module are included as
working examples of how the auth guards and S3 config are meant to be used —
extend or replace them for your actual domain.

## Prerequisites

- Node.js 22+, [pnpm](https://pnpm.io) 10
- Docker (for local Postgres/Redis, or bring your own)

## Setup

```bash
pnpm install
cp .env.example .env   # fill in JWT_SECRET at minimum; see below for optional integrations

# Start Postgres + Redis
docker compose -f docker-compose.dev.yml up -d db redis

# Apply the schema and seed an admin user + roles
pnpm exec prisma migrate dev
pnpm exec prisma db seed

# Run the API
pnpm start:dev
```

The API listens on `http://localhost:8000/api/v1`, with Swagger at
`http://localhost:8000/api/v1/docs`.

### Environment variables

See `.env.example` for the full list. Only `DATABASE_URL`, `JWT_SECRET`, and
Redis vars are required to boot. SMTP, Twilio, AWS, and Firebase are optional —
each integration only fails when it's actually used (sending an email/SMS/push,
or uploading a file), not at startup.

## Project structure

```
src/
  app.module.ts        # wires everything together
  main.ts               # bootstrap, CORS, Swagger, global prefix
  common/                # response shape, exception filters, mail/SMS services, DTOs
  config/                # Prisma, Redis, S3, Firebase, socket.io adapter
  decorators/             # @Public, @Auth, @RoleChecker, @CurrentUser
  guards/                 # JwtAuthGuard, RolesGuard
  health/                 # GET /health
  queue/                  # BullMQ queues + processors (email, sms, push)
  modules/
    auth/                 # register / login / me — example of the auth stack in use
    upload/                # S3 upload — example of storageConfig() in use
prisma/
  schema/schema.prisma    # Role, User, UserDevice models
  seed.ts                 # seeds admin/user roles + an admin account
```

## Adding a new module

Follow the pattern in `src/modules/auth`: a `<name>.module.ts`,
`<name>.controller.ts`, `<name>.service.ts`, and a `dto/` folder, then add the
module to the `imports` array in `src/app.module.ts`. Protect routes with
`@Auth()` (optionally combined with `@RoleChecker('admin')`), or mark them
`@Public()` if no controller-level guard applies.

## Scripts

| Command | What it does |
|---|---|
| `pnpm start:dev` | Run the API with hot reload |
| `pnpm build` | Compile to `dist/` |
| `pnpm lint` | ESLint (+ `--fix`) |
| `pnpm test` / `test:e2e` | Unit / e2e tests |
| `pnpm exec prisma migrate dev` | Create/apply a migration |
| `pnpm exec prisma db seed` | Re-run the seed script |
| `pnpm docker:start` | Bring up Postgres, Redis, and the API via `scripts/start.sh` |

## Deployment

`Dockerfile` builds a production image (migrate + seed run automatically on
container start); `compose.yml` runs it alongside Postgres and Redis. `Caddyfile`
is a sample reverse-proxy site block — replace `your-domain.example.com` with
your own domain if you use it.

## Extending further

The queue layer already defines job types for OTP email/SMS
(`src/queue/interfaces/queue-job.interface.ts`) and the processors handle them —
they're just not wired into an endpoint yet. A refresh-token flow and a
users-management module are natural next additions on top of `src/modules/auth`.
