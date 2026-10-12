# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/api/Dockerfile .
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Prisma needs OpenSSL to pick the right engine/TLS libraries.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# 1. Keep only the workspaces @finnit/api depends on (api + database + configs).
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.9.14 prune @finnit/api --docker

# 2. Install from package manifests first so the dependency layer is cached.
FROM base AS builder
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ ./
RUN pnpm --filter @finnit/database db:generate \
 && pnpm --filter @finnit/database build \
 && pnpm --filter @finnit/api build

# 3. Runtime. Keeps the Prisma CLI so the entrypoint can apply migrations.
FROM base AS runner
# Links the GHCR package to the repository (permissions and visibility).
LABEL org.opencontainers.image.source="https://github.com/iamcharlizard/finnit-assistant" \
      org.opencontainers.image.description="Finnit GraphQL API"
ENV NODE_ENV=production \
    PORT=3000
COPY --from=builder --chown=node:node /repo ./
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
