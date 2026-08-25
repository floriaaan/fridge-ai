# Built with the monorepo root as build context (needs pnpm-workspace.yaml
# and the lockfile) — see compose.yml: build.context: . / dockerfile: backend/Dockerfile

FROM node:26-alpine AS base
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
RUN pnpm install --frozen-lockfile --filter fridge-ai-backend...

FROM deps AS build
COPY backend ./backend
RUN pnpm --filter fridge-ai-backend run build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S fridgeai && adduser -S fridgeai -G fridgeai
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/build ./backend/build
COPY --from=build /app/backend/package.json ./backend/package.json
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R fridgeai:fridgeai /app
USER fridgeai
WORKDIR /app/backend/build
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "bin/server.js"]
