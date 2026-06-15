FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY . .
WORKDIR /app/gateway/public-api
# Generate the Prisma client into shared/db/generated/client BEFORE installing
# this service, so pnpm copies the already-generated dir into the service's
# isolated @x-hunter/db copy (see prisma-pnpm-monorepo-fix).
RUN cd ../../shared/db && pnpm install --prod=false && pnpm run generate
RUN pnpm install --prod=false
RUN pnpm run build

FROM node:22-slim
WORKDIR /app/gateway/public-api
ENV NODE_ENV=production
# Prisma's query engine needs OpenSSL at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Install tsx globally so the entrypoint does not depend on pnpm's nested bin
# layout (shared workspace packages export TS source, run via tsx).
RUN npm install -g tsx@4.19.2
COPY --from=build /app /app
EXPOSE 4000
CMD ["tsx", "src/server.ts"]
