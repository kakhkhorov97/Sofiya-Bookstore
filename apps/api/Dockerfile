# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t sofiya-api .
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @sofiya/shared && npm run build -w @sofiya/api

FROM node:20-alpine AS run
ENV NODE_ENV=production PORT=8080
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# Production dependencies of the api only; @sofiya/shared is linked as a workspace.
RUN npm ci --omit=dev -w @sofiya/api && npm cache clean --force
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
# SQL migrations, applied with: node dist/db/migrate.js
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /repo/apps/api
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
