FROM golang:1.26-alpine AS build
WORKDIR /src/workers
COPY workers/go.mod workers/go.sum ./
RUN go mod download
COPY workers ./
RUN go build -o /out/N ./N/cmd/N

FROM alpine:3.20
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/N /usr/local/bin/N
EXPOSE 5130
CMD ["N"]
