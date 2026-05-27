FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/zap-signal/go.mod ./
COPY workers/zap-signal ./
RUN go build -o /out/zap-signal ./cmd/zap-signal

FROM alpine:3.20
COPY --from=build /out/zap-signal /usr/local/bin/zap-signal
EXPOSE 5120
CMD ["zap-signal"]
