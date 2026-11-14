FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/identity... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3009
EXPOSE 3009
CMD ["node", "services/identity/dist/main.js"]
