# syntax=docker/dockerfile:1.7-labs
FROM oven/bun:1.3.5

WORKDIR /app

# Dependency manifests only: the install layer stays cached across
# source-only changes, which is most deploys.
COPY --parents package.json bun.lock .npmrc patches apps/*/package.json packages/*/package.json examples/extensions/*/package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx tsc -b packages/lib packages/channels packages/ai packages/core packages/apps-sdk packages/ui packages/cli apps/server
RUN cd apps/server && bunx tsc -p web/tsconfig.json --pretty false && bunx vite build --config web/vite.config.ts

CMD ["sh", "-lc", "bun packages/cli/dist/cli.js init && exec bun apps/server/dist/cli.js"]
