FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/commerce... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3001
EXPOSE 3001
CMD ["node", "services/commerce/dist/main.js"]
