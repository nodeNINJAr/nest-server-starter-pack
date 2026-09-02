# stage 1: dependencies
FROM node:24-slim AS deps

WORKDIR /app

# enable corepack and install pnpm NOW (bakes it into the layer — no runtime download)
RUN corepack enable && corepack prepare pnpm@10 --activate

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma/
# Dummy DATABASE_URL so prisma generate doesn't fail at build time
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
# install ALL deps (dev included — needed for build + prisma generate)
RUN pnpm install --frozen-lockfile
# generate Prisma client (writes into node_modules/@prisma + .prisma)
RUN pnpm exec prisma generate


# stage 2: builder
FROM deps AS builder
WORKDIR /app

COPY . .

RUN pnpm build

# Prune dev deps AFTER build
RUN pnpm prune --prod


# stage 3: production runtime
FROM node:24-slim AS production

WORKDIR /app

# Bake pnpm into this stage too (same version, no runtime download)
RUN corepack enable && corepack prepare pnpm@10 --activate

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl wget && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 nodejs && \
    useradd  --uid 1001 --gid nodejs --shell /bin/bash --create-home nestjs

# runtime artifacts
COPY --from=builder --chown=nestjs:nodejs /app/node_modules    ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist            ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma          ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/src/common/services/templates ./dist/src/common/services/templates
COPY --from=builder --chown=nestjs:nodejs /app/package.json    ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# re-copy the Prisma CLI binary from builder ────────────────────────────────
# pnpm prune --prod removes prisma (a devDependency) from node_modules,
# so its CLI binary disappears. We copy it back explicitly from the pre-prune
# deps stage so `prisma migrate deploy` works at container startup.
COPY --from=deps --chown=nestjs:nodejs /app/node_modules/.bin/prisma          ./node_modules/.bin/prisma
COPY --from=deps --chown=nestjs:nodejs /app/node_modules/prisma               ./node_modules/prisma
COPY --from=deps --chown=nestjs:nodejs /app/node_modules/@prisma/client       ./node_modules/@prisma/client

RUN mkdir -p /app/uploads && chown -R 1001:1001 /app/uploads
#USER nestjs

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/v1/health || exit 1

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec prisma db seed && node dist/src/main"]
