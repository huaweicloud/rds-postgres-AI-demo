# Build context is the repository root, so the workspace packages resolve.
FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY worker/package.json worker/
COPY web/package.json web/
RUN npm ci --workspace @stackdowser/web --workspace @stackdowser/db --include-workspace-root
COPY packages/db packages/db
COPY web web
RUN npm run build --workspace @stackdowser/db && npm run build --workspace @stackdowser/web

FROM node:22.23.4-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static web/.next/static
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
