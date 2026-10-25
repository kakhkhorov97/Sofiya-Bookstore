# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t sofiya-api .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @sofiya/api...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @sofiya/shared build && pnpm --filter @sofiya/api build
# Production-only node_modules for the api, with the shared package bundled in.
RUN pnpm --filter @sofiya/api deploy --prod --legacy /out

FROM node:20-alpine AS run
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
# SQL migrations, applied with: node dist/db/migrate.js
COPY --from=build /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
