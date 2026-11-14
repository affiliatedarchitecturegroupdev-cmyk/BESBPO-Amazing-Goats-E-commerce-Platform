FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/payments... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3005
EXPOSE 3005
CMD ["node", "services/payments/dist/main.js"]
