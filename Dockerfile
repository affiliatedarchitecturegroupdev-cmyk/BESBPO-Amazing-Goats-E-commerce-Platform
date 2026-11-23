# Root Dockerfile — the default path Northflank looks for.
#
# The platform is a pnpm monorepo, so a single root build can produce any of the
# Node targets. Pick one with a build argument:
#
#   docker build --build-arg SERVICE=gateway        -t ag-gateway .
#   docker build --build-arg SERVICE=storefront     -t ag-storefront .
#   docker build --build-arg SERVICE=trade-portal   -t ag-trade-portal .
#
# `SERVICE` takes the workspace directory name (`services/gateway`,
# `apps/storefront`). The per-workspace Dockerfiles remain the preferred path —
# they give each service its own cache and build plan — and this file exists so
# a service created with Northflank's default root Dockerfile path still builds.
#
# The two Python services (`ai-forecast`, `analytics`) need a different base
# image and keep their own Dockerfiles; they are not built from here.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- dependencies: cached until the lockfile changes -------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN pnpm install --frozen-lockfile

# --- build: compile the chosen workspace and everything it depends on --------
FROM deps AS build
ARG SERVICE=gateway
COPY . .
# Fail here, with a readable message, rather than in the filter's output.
RUN test -d "services/${SERVICE}" -o -d "apps/${SERVICE}" \
      || { echo "SERVICE='${SERVICE}' is not a workspace under services/ or apps/" >&2; exit 1; }
RUN pnpm --filter "@ag/${SERVICE}..." build

# --- runtime ----------------------------------------------------------------
FROM node:20-alpine AS runtime
ARG SERVICE=gateway
ENV NODE_ENV=production
ENV SERVICE=${SERVICE}
WORKDIR /app
COPY --from=build /app .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
