FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ag/partners... build
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
ENV PORT=3008
EXPOSE 3008
CMD ["node", "services/partners/dist/main.js"]
