FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/partner-portal... build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/apps/partner-portal
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
