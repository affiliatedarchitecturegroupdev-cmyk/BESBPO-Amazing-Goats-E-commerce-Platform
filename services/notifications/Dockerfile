FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/notifications... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3006
EXPOSE 3006
CMD ["node", "services/notifications/dist/main.js"]
