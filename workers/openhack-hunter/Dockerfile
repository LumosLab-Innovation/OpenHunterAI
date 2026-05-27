FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/openhack-hunter/go.mod ./
COPY workers/openhack-hunter ./
RUN go build -o /out/openhack-hunter ./cmd/openhack-hunter

FROM alpine:3.20
COPY --from=build /out/openhack-hunter /usr/local/bin/openhack-hunter
EXPOSE 5140
CMD ["openhack-hunter"]
