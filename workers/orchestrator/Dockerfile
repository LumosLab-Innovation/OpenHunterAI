FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/orchestrator/go.mod ./
COPY workers/orchestrator ./
RUN go build -o /out/orchestrator ./cmd/orchestrator

FROM alpine:3.20
COPY --from=build /out/orchestrator /usr/local/bin/orchestrator
EXPOSE 5100
CMD ["orchestrator"]
