FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/strix-core/go.mod ./
COPY workers/strix-core ./
RUN go build -o /out/strix-core ./cmd/strix-core

FROM alpine:3.20
COPY --from=build /out/strix-core /usr/local/bin/strix-core
EXPOSE 5150
CMD ["strix-core"]
