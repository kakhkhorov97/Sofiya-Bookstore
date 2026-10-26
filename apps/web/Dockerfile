# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t sofiya-web .
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/web apps/web
# The browser's /api/* requests are forwarded to this address. Next.js fixes
# rewrites when it builds, so the API's URL must be known now, not at start:
#   docker build --build-arg API_URL=https://sofiya-api-xyz.a.run.app/api ...
ARG API_URL
RUN test -n "$API_URL" || (echo "Pass --build-arg API_URL=https://<api-service>/api" && exit 1)
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @sofiya/shared && npm run build -w @sofiya/web

FROM node:20-alpine AS run
ARG API_URL
# Server components call the API directly at the same address.
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 API_URL=$API_URL
WORKDIR /app
# Standalone output keeps the monorepo layout under apps/web.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
