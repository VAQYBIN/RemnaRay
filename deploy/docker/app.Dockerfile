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
# One production closure for the single app image required by section 26.1.
# Separate deployments duplicate Prisma and Nest across API, worker and tools.
RUN pnpm deploy --filter=@remnaray/runtime --prod /out/runtime

FROM node:24-alpine

# Section 20.4: the `migrate` service takes a `pg_dump` before a migration that
# cannot be undone, so the runtime image needs the client of the server's major
# version. It is pinned, like every other package in these images.
ARG POSTGRES_CLIENT_VERSION=18.6-r0
RUN apk add --no-cache "postgresql18-client=${POSTGRES_CLIENT_VERSION}" \
    && pg_dump --version \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
# The release this image is (section 24.6): `/admin/system` shows it and the
# update check compares with it. The workflows pass the tag; a source build
# is `0.0.0-dev`, which never claims an update.
ARG RR_APP_VERSION=0.0.0-dev
ENV RR_APP_VERSION=${RR_APP_VERSION}
WORKDIR /app

COPY --from=build /out/runtime/node_modules ./node_modules

# Preserve the public entrypoints used by Compose. Node follows the symlinks
# into the deployed packages, where pnpm's isolated dependency links resolve.
RUN mkdir -p dist/apps dist/packages \
    && ln -s ../../node_modules/@remnaray/api/dist dist/apps/api \
    && ln -s ../../node_modules/@remnaray/bot/dist dist/apps/bot \
    && ln -s ../../node_modules/@remnaray/worker/dist dist/apps/worker \
    && ln -s ../../node_modules/@remnaray/db dist/packages/db \
    && ln -s apps/api/tools dist/tools

# Docker seeds a fresh named volume from the image, ownership included. The
# renderer and the uploads both run as `node`, and a volume Docker created
# root-owned would refuse the first write instead of the hundredth.
RUN mkdir -p /proxy-conf /uploads && chown node:node /proxy-conf /uploads

USER node

CMD ["node", "dist/apps/api/main.js"]
