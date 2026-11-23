FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/trade-portal... build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/apps/trade-portal
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
