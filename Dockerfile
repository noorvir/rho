FROM oven/bun:1.3.5

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bunx tsc -b packages/lib packages/channels packages/ai packages/core packages/apps-sdk apps/server
RUN cd apps/server && bunx tsc -p web/tsconfig.json --pretty false && bunx vite build --config web/vite.config.ts

CMD ["bun", "apps/server/dist/cli.js"]
