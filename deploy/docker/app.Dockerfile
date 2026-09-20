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

# Section 20.4: the `migrate` service takes a `pg_dump` before a migration that
# cannot be undone, so the runtime image needs the client of the server's major
# version. It is pinned, like every other package in these images.
ARG POSTGRES_CLIENT_VERSION=18.6-r0
RUN apk add --no-cache "postgresql18-client=${POSTGRES_CLIENT_VERSION}" \
    && pg_dump --version \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /workspace/node_modules/.pnpm ./dist/node_modules/.pnpm
COPY --from=build /workspace/apps/api/dist ./dist/apps/api
COPY --from=build /workspace/apps/api/node_modules ./dist/apps/api/node_modules
COPY --from=build /workspace/apps/bot/dist ./dist/apps/bot
COPY --from=build /workspace/apps/bot/node_modules ./dist/apps/bot/node_modules
COPY --from=build /workspace/apps/worker/dist ./dist/apps/worker
COPY --from=build /workspace/apps/worker/node_modules ./dist/apps/worker/node_modules
# `migrate` runs `prisma migrate deploy` from the db package, so it needs the
# schema, the migrations and the Prisma CLI beside them.
COPY --from=build /workspace/packages/db/package.json ./dist/packages/db/package.json
COPY --from=build /workspace/packages/db/prisma ./dist/packages/db/prisma
COPY --from=build /workspace/packages/db/dist ./dist/packages/db/dist
COPY --from=build /workspace/packages/db/node_modules ./dist/packages/db/node_modules

# Section 21.1 runs the deployment tools as `dist/tools/*.js`. They are built
# with the API so they share its `node_modules`; Node resolves through the
# symlink, so the modules are found next to the real files.
RUN ln -s apps/api/tools dist/tools

USER node

CMD ["node", "dist/apps/api/main.js"]
