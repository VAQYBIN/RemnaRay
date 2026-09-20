FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
# Prerendering reads the shipped catalogs and the theme; at runtime both come
# from the read-only volumes of section 21.1.
COPY locales ./locales
COPY themes ./themes

RUN pnpm install --frozen-lockfile
# Prerendering asks the API for config, catalogs and the theme and falls back
# to the shipped files when it cannot answer. Nothing serves `api` during a
# build, so the fallback is always the one taken; pointing the client at a
# closed port makes that refusal immediate instead of leaving it to whatever
# the builder's resolver does with an unknown host. Compose sets the real
# value at runtime.
ENV INTERNAL_API_URL=http://127.0.0.1:1
# Turbo, not a plain filter: `@remnaray/domain` is imported from its build
# output, so the workspace packages have to be built before Next.js runs.
RUN pnpm turbo run build --filter=@remnaray/web

FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static

USER node

CMD ["node", "apps/web/server.js"]
