FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/stock... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3002
EXPOSE 3002
CMD ["node", "services/stock/dist/main.js"]
