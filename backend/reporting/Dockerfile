FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY . .
WORKDIR /app/backend/reporting
# Generate Prisma client into shared/db/generated/client BEFORE installing this
# service so the generated dir is copied into the service's isolated db copy.
RUN cd ../../shared/db && pnpm install --prod=false && pnpm run generate
RUN pnpm install --prod=false
RUN pnpm run build

FROM node:22-slim
WORKDIR /app/backend/reporting
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g tsx@4.19.2
COPY --from=build /app /app
EXPOSE 4400
CMD ["tsx", "src/server.ts"]
