FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/Z/go.mod ./
COPY workers/Z ./
RUN go build -o /out/Z ./cmd/Z

FROM alpine:3.20
COPY --from=build /out/Z /usr/local/bin/Z
EXPOSE 5120
CMD ["Z"]
