FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/logistics... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3004
EXPOSE 3004
CMD ["node", "services/logistics/dist/main.js"]
