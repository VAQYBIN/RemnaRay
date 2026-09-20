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
# Keep only production dependency closures for the runtime image. Copying the
# root pnpm store made the image exceed NFR-011 by more than a gigabyte.
RUN pnpm deploy --filter=@remnaray/api --prod /out/api \
    && pnpm deploy --filter=@remnaray/bot --prod /out/bot \
    && pnpm deploy --filter=@remnaray/worker --prod /out/worker \
    && pnpm deploy --filter=@remnaray/db --prod /out/db

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

COPY --from=build /out/api/dist ./dist/apps/api
COPY --from=build /out/api/node_modules ./dist/apps/api/node_modules
COPY --from=build /out/bot/dist ./dist/apps/bot
COPY --from=build /out/bot/node_modules ./dist/apps/bot/node_modules
COPY --from=build /out/worker/dist ./dist/apps/worker
COPY --from=build /out/worker/node_modules ./dist/apps/worker/node_modules
# `migrate` runs `prisma migrate deploy` from the db package, so it needs the
# schema, the migrations and the Prisma CLI beside them.
COPY --from=build /out/db/package.json ./dist/packages/db/package.json
COPY --from=build /out/db/prisma ./dist/packages/db/prisma
COPY --from=build /out/db/dist ./dist/packages/db/dist
COPY --from=build /out/db/node_modules ./dist/packages/db/node_modules

# Section 21.1 runs the deployment tools as `dist/tools/*.js`. They are built
# with the API so they share its `node_modules`; Node resolves through the
# symlink, so the modules are found next to the real files.
RUN ln -s apps/api/tools dist/tools

USER node

CMD ["node", "dist/apps/api/main.js"]
