FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/accounts... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3003
EXPOSE 3003
CMD ["node", "services/accounts/dist/main.js"]
