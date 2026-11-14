FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/ads... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3007
EXPOSE 3007
CMD ["node", "services/ads/dist/main.js"]
