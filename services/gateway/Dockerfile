FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/gateway... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "services/gateway/dist/main.js"]
