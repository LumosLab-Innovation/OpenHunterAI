FROM golang:1.26-alpine AS build
WORKDIR /src/workers
COPY workers/go.mod workers/go.sum ./
RUN go mod download
COPY workers ./
RUN go build -o /out/retest ./retest/cmd/retest

FROM alpine:3.20
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/retest /usr/local/bin/retest
EXPOSE 5160
CMD ["retest"]
