FROM oven/bun:1.3.5

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bunx tsc -b packages/lib packages/channels packages/ai packages/core packages/apps-sdk apps/server
RUN cd apps/server && bunx tsc -p web/tsconfig.json --pretty false && bunx vite build --config web/vite.config.ts

CMD ["sh", "-lc", "mkdir -p /data/rho/state/db && DATABASE_URL=\"$RHO_DATABASE_URL\" bun node_modules/.bun/prisma@*/node_modules/prisma/build/index.js db push --config packages/core/prisma.config.ts && exec bun apps/server/dist/cli.js"]
