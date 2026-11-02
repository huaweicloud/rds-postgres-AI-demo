# Build context is the repository root, so the workspace packages resolve.
FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY worker/package.json worker/
COPY web/package.json web/
RUN npm ci --workspace @stackdowser/worker --workspace @stackdowser/db --include-workspace-root
COPY packages/db packages/db
COPY worker worker
RUN npm run build --workspace @stackdowser/db && npm run build --workspace @stackdowser/worker

# Production dependencies only, installed fresh: npm prune with workspace flags keeps some
# dev packages and drops some runtime ones.
FROM node:22.23.4-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY worker/package.json worker/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace @stackdowser/worker --workspace @stackdowser/db

FROM node:22.23.4-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
# Packages whose version clashes with a hoisted one are nested here (p-limit, for one).
COPY --from=deps /app/worker/node_modules worker/node_modules
COPY --from=build /app/packages/db/package.json packages/db/
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/worker/package.json worker/
COPY --from=build /app/worker/dist worker/dist
USER node
WORKDIR /app/worker
CMD ["node", "dist/index.js"]
