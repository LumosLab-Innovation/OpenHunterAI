FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY . .
WORKDIR /app/frontend
RUN pnpm install --prod=false
RUN pnpm run build

FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
