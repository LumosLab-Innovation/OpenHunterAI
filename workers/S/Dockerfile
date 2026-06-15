FROM golang:1.26-alpine AS build
WORKDIR /src/workers
COPY workers/go.mod workers/go.sum ./
RUN go mod download
COPY workers ./
RUN go build -o /out/S ./S/cmd/S

FROM alpine:3.20
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/S /usr/local/bin/S
EXPOSE 5150
CMD ["S"]
