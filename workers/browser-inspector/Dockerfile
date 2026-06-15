FROM golang:1.26-alpine AS build
WORKDIR /src/workers
COPY workers/go.mod workers/go.sum ./
RUN go mod download
COPY workers ./
RUN go build -o /out/browser-inspector ./browser-inspector/cmd/browser-inspector

FROM alpine:3.20
RUN apk add --no-cache ca-certificates chromium nss freetype harfbuzz ttf-freefont
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/browser-inspector /usr/local/bin/browser-inspector
EXPOSE 5110
CMD ["browser-inspector"]
