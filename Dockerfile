FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate

# Run as a one-off release job, never as part of API/worker startup.
FROM dependencies AS tools
COPY scripts ./scripts
USER node
CMD ["pnpm", "db:deploy"]

FROM dependencies AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN pnpm build
RUN pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
