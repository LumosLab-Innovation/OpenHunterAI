FROM golang:1.22-alpine AS build
WORKDIR /src/workers
COPY workers/go.mod workers/go.sum ./
RUN go mod download
COPY workers ./
RUN go build -o /out/orchestrator ./orchestrator/cmd/orchestrator

FROM alpine:3.20
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/orchestrator /usr/local/bin/orchestrator
EXPOSE 5100
CMD ["orchestrator"]
