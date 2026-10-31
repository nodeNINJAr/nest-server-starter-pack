# Universal NestJS backend starter

A modular monolith for general backend projects: REST APIs, SaaS products, internal tools, marketplaces, and business applications. It includes authentication, PostgreSQL through Prisma, Redis, background jobs, and optional S3/email/SMS/push integrations. Business-specific models, tenancy, and billing belong in feature modules rather than the core.

## Structure

```text
src/
  main.ts                 HTTP entry point
  worker.ts               Background worker entry point (no HTTP server)
  app.module.ts           HTTP composition root
  app.setup.ts            Shared HTTP configuration for runtime and tests
  core/
    config/               Validated environment configuration
    security/             Global JWT, role and rate-limit guards; decorators
  common/
    http/                 Response contracts, DTOs, exception filter, request IDs
  infrastructure/
    database/             Prisma lifecycle and database connection
    redis/                Cache, rate limiting and ownership-based locks
    storage/              Lazy, optional S3 upload adapter
    messaging/            Lazy email, SMS and Firebase adapters; email templates
    queue/                Typed job contracts, producers, separate worker module
  modules/
    auth/                 Registration, login, refresh, logout, current user
    health/               Liveness and dependency readiness
    upload/               Authenticated image upload API
    notifications/        Example user-device notification orchestration
prisma/
  schema/                 Models, grouped by concern
  migrations/             Committed database migrations
  seed.ts                 Idempotent reference roles only
scripts/
  create-admin.ts         Explicit administrator provisioning
  start.sh                Local Docker startup and migrations

deploy/nginx.conf         Host Nginx reverse-proxy example
```

Dependencies flow from feature modules to infrastructure and core. Infrastructure must not import feature modules. `common` contains HTTP utilities, not business services. Database and Redis providers require explicit module imports. The API imports queue producers; only `WorkerModule` imports processors. The same source tree and runtime image support both processes. Development watchers use separate output folders (`dist` and `dist-worker`) to avoid deleting each other's builds.

## Local setup

Use Node.js 22.12+ (Docker uses Node.js 24) and the pinned pnpm version in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `JWT_SECRET`. Empty secrets, short secrets, placeholder secrets, invalid ports, and malformed origins fail at startup. `.env.local` overrides `.env`; exported process variables take precedence. Never commit either file.

Run the API locally with dependencies in Docker:

```bash
docker compose -f docker-compose.dev.yml up -d --wait db redis
pnpm db:generate
pnpm db:deploy
pnpm start:dev
# Separate terminal, when you need background delivery:
pnpm start:worker:dev
```

Or run the complete development stack with `pnpm docker:start`. The script waits for dependencies, generates the Prisma client, applies migrations, then starts API and worker processes. It does not create an administrator or seed users. PostgreSQL and Redis bind to loopback ports 5434 and 6389 for host development; Compose overrides their addresses inside containers.

API: `http://localhost:8000/api/v1`. Development documentation: `/api/v1/docs` when `SWAGGER_ENABLED=true`.

## Authentication and authorization

All controller routes require authentication by default. Mark intentionally public routes with `@Public()`. `@Auth()` adds bearer authentication documentation; it is not required to secure a route. `@RoleChecker('admin')` requires the authenticated user's current database role. Role checks do not replace resource-ownership checks in feature services.

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Access tokens expire after 15 minutes and contain a session ID. Refresh tokens expire after 30 days, store only a bcrypt hash, and rotate in a transaction. A conditional update allows only one concurrent refresh to consume a session. Failed replacement inserts roll back revocation. Registration and its initial session also share a transaction.

Access-token authentication checks the current session and user status, so logout and account suspension affect subsequent requests immediately. Refreshing revokes the previous session and its associated access token. Clients must serialize refresh requests and atomically replace both tokens. Existing access tokens issued before this starter update lack a session ID and require login again.

Logout requires the full refresh token; a session ID alone cannot revoke another session. Logout of an expired/revoked token returns 401. Passwords are limited to 72 UTF-8 bytes to prevent bcrypt truncation.

Public auth endpoints have Redis-backed limits per IP and endpoint: registration 5/minute, login 10/minute, refresh/logout 30/minute. Limits are shared across API replicas. A Redis failure does not bypass the guard. Use `@RateLimit(limit, windowSeconds)` for additional routes. Adapt limits for shared NATs and your product's traffic.

For a fresh project, seed reference roles if desired:

```bash
pnpm db:seed
```

To create an administrator, set `ADMIN_EMAIL`, `ADMIN_USERNAME`, and a unique `ADMIN_PASSWORD` in your environment, then run `pnpm db:admin`. Provisioning refuses to modify or elevate an existing account. There are no default accounts or passwords and no seeds during production startup.

## Optional integrations

Missing AWS, SMTP, Twilio, or Firebase credentials do not prevent API or worker startup. An attempted use fails explicitly so jobs can retry; credentials and provider clients are initialized through injected configuration at first use.

- **S3:** set `AWS_REGION` and `AWS_S3_BUCKET`. Set both static credential variables or leave both empty for the AWS default credential chain/IAM role. `/upload` accepts one image; `/upload/multiple` accepts up to ten. The default size limit is 5 MiB per file (`UPLOAD_MAX_BYTES`). Declared JPEG, PNG, WebP and GIF MIME types are allowed. MIME filtering is not malware scanning or content verification; add those when your product needs them. S3 objects follow bucket policy; returned locations do not imply public access. Record object ownership and authorize downloads in your feature module before using private documents.
- **Email:** set `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM`; add credentials when required. Port 465 uses TLS immediately; other ports use the transport's STARTTLS negotiation. Certificate verification remains enabled. Templates are bundled into `dist` by Nest, so local production builds work too.
- **SMS:** set `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE`.
- **Push:** set `FIREBASE_SERVICE_ACCOUNT` to the service-account JSON. Device fan-out lives in the notifications feature, not the queue infrastructure.

Run a worker to consume queued jobs. Retries use exponential backoff, with five attempts. Queue delivery is at least once: providers may receive duplicates after a crash. Add business idempotency keys and an outbox when a database change and an external message must be delivered reliably together. Job inspection deliberately omits payloads that may contain OTPs or reset links.

Redis locks return an ownership token, which `releaseLock(key, token)` verifies atomically. Expiration does not provide fencing or automatic renewal; do not use these short-lived locks as the sole correctness mechanism for financial or long-running work.

## HTTP behavior and health

- Exact `CORS_ORIGINS` allowlist; tunnel domains are not trusted automatically. CORS controls browser access, not authorization.
- Validation rejects unknown DTO properties. Controllers return `ApiResponses.success(...)`; there is no interceptor wrapping responses a second time.
- The global exception filter produces `{ success: false, message, error: { code, statusCode, details, errors, traceId } }`, translates known Prisma errors, and hides internal error messages.
- Responses carry `X-Request-Id`; error trace IDs match that header.
- `GET /api/v1/health` is public liveness. `GET /api/v1/health/ready` checks PostgreSQL and Redis with a two-second response deadline and returns 503 on failure. These checks do not verify third-party delivery or worker health.
- Shutdown signals close Prisma, Redis, queue workers, and initialized integration clients through Nest lifecycle hooks.

## Production and Nginx

Change development database/Redis passwords, set a strong JWT secret, configure exact production origins, and disable Swagger unless intentionally exposing it. The runtime image runs as a non-root user. API and worker startup do not apply migrations or create accounts.

```bash
docker compose -f compose.yml build
docker compose -f compose.yml up -d --wait postgres redis
# Apply migrations once as a controlled release step before starting this version.
docker compose -f compose.yml --profile tools run --rm migrate
docker compose -f compose.yml up -d api worker
```

The `tools` build target retains Prisma CLI and provisioning tools; the runtime image contains production dependencies and compiled code. For reference seeds or explicit provisioning, use `docker compose -f compose.yml --profile tools run --rm migrate pnpm db:seed` or `... pnpm db:admin` with the provisioning environment supplied. Use backward-compatible migrations when old and new versions overlap.

`deploy/nginx.conf` is an example for Nginx installed on the Docker host. Replace `api.example.com`, install it in your Nginx configuration, configure TLS certificates, and verify with `nginx -t` before reloading Nginx. The sample is HTTP-only until you add TLS. It proxies to the API's loopback-only `127.0.0.1:8081` port. It forwards every API route, including multipart uploads. Keep its 55 MiB total request limit in sync with the application's per-file limit and ten-file cap.

Compose sets `TRUST_PROXY_HOPS=1` because Nginx is the only public ingress and overwrites forwarding headers. For direct local access use 0; change this deliberately for other proxy topologies. The worker exposes no HTTP port. Add external worker/queue monitoring appropriate to your deployment.

## Adding a feature

1. Create `src/modules/<feature>/<feature>.module.ts`, controller, service, and `dto/` files.
2. Import only needed infrastructure modules and export a small service API for other features.
3. Register the module in `AppModule`; routes are protected automatically.
4. Keep DTO validation at the HTTP boundary and enforce ownership and business rules in the service.
5. Put related database writes in a transaction. Other features call the owning service rather than editing its tables.
6. Add repositories or domain layers when their complexity justifies them; the starter does not require extra layers for simple CRUD.

For a multi-tenant product, add tenant context, memberships, resource permissions, and enforced tenant-scoped queries before introducing tenant data. This universal starter does not claim tenant isolation, billing, password-reset endpoints, or email verification workflows merely because notification templates exist.

## Checks

```bash
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test --runInBand
pnpm test:e2e --runInBand
pnpm build
# Or all checks after generation:
pnpm check
```

Prisma generation needs `DATABASE_URL` for CLI configuration but does not connect to the database. Unit tests cover environment validation, transactional session behavior, token validation and error contracts. HTTP tests compile the real application and shared bootstrap with database, Redis, and queue providers mocked; they need permission to open local sockets. They cover default authentication, roles, request IDs, validation, readiness, optional storage and rate limiting. They do not prove PostgreSQL transaction behavior or external provider delivery; test those against actual services before deployment.
