FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY . .
WORKDIR /app/gateway/public-api
RUN pnpm install --prod=false
RUN cd ../../shared/db && pnpm install --prod=false && pnpm run generate
RUN pnpm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["node", "/app/gateway/public-api/dist/server.js"]
