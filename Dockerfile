# syntax=docker/dockerfile:1

FROM node:22-alpine AS client-builder

WORKDIR /build/client

ARG BUILD_ID=
ENV VITE_BUILD_ID=$BUILD_ID
# Same-origin in production: Express serves the SPA, so leave the API URL empty.
ENV VITE_API_URL=

COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-builder

WORKDIR /build/server

COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build \
  && npx tsc migrate.ts --esModuleInterop --skipLibCheck --module commonjs --target ES2020 --outDir /tmp/migrate

FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/server && npm ci --omit=dev --no-audit --no-fund \
    && chown -R nodejs:nodejs /app/server/node_modules

COPY --from=server-builder --chown=nodejs:nodejs /build/server/dist ./server/dist
COPY --from=server-builder --chown=nodejs:nodejs /tmp/migrate/migrate.js ./server/migrate.js
COPY --from=server-builder --chown=nodejs:nodejs /build/server/migrations ./server/migrations
COPY --from=client-builder --chown=nodejs:nodejs /build/client/dist ./client
COPY --chown=nodejs:nodejs --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

ARG BUILD_ID=
ENV BUILD_ID=$BUILD_ID \
    NODE_ENV=production \
    PORT=3005 \
    CLIENT_DIST_DIR=/app/client

USER nodejs
EXPOSE 3005
WORKDIR /app/server

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3005)+'/api/health',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
