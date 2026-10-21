# InStep server + companion (one container). Serves /c/ (phones), the WebSocket relay, REST, media and /mcp.
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/companion ./apps/companion
COPY content ./content
RUN pnpm install --frozen-lockfile
# downloads MediaPipe models + WASM into public/models (served locally, no CDN at runtime)
RUN pnpm --filter @instep/companion build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production DATA_DIR=/data TV_HTTP_PORT=8788 HOST=0.0.0.0
WORKDIR /app/apps/server
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||10000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "--import", "tsx", "src/main.ts"]
