FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @remnaray/db db:generate
# Turbo, not three plain filters: the API's OpenAPI generation loads
# `@remnaray/domain` from its build output, so the workspace packages have to
# be built first.
RUN pnpm turbo run build \
      --filter=@remnaray/api \
      --filter=@remnaray/bot \
      --filter=@remnaray/worker

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

# Section 21.1 runs the deployment tools as `dist/tools/*.js`. They are built
# with the API so they share its `node_modules`; Node resolves through the
# symlink, so the modules are found next to the real files.
RUN ln -s apps/api/tools dist/tools

USER node

CMD ["node", "dist/apps/api/main.js"]
