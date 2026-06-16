FROM mcr.microsoft.com/playwright:v1.61.0-noble AS build

WORKDIR /app/backend/browser-session
COPY backend/browser-session/package*.json ./
RUN npm ci
COPY backend/browser-session ./
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.0-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb x11vnc fluxbox novnc websockify \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV BROWSER_SESSION_PORT=4700
ENV NOVNC_WEB_ROOT=/usr/share/novnc

WORKDIR /app/backend/browser-session
COPY --from=build /app/backend/browser-session/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/browser-session/dist ./dist

EXPOSE 4700
CMD ["node", "dist/server.js"]
