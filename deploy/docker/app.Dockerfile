FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @remnaray/db db:generate
RUN pnpm --filter @remnaray/api build
RUN pnpm --filter @remnaray/bot build
RUN pnpm --filter @remnaray/worker build

FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/node_modules/.pnpm ./dist/node_modules/.pnpm
COPY --from=build /workspace/apps/api/dist ./dist/apps/api
COPY --from=build /workspace/apps/api/node_modules ./dist/apps/api/node_modules
COPY --from=build /workspace/apps/bot/dist ./dist/apps/bot
COPY --from=build /workspace/apps/bot/node_modules ./dist/apps/bot/node_modules
COPY --from=build /workspace/apps/worker/dist ./dist/apps/worker
COPY --from=build /workspace/apps/worker/node_modules ./dist/apps/worker/node_modules

USER node

CMD ["node", "dist/apps/api/main.js"]
