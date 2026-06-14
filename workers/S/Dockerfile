FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/S/go.mod ./
COPY workers/S ./
RUN go build -o /out/S ./cmd/S

FROM alpine:3.20
COPY --from=build /out/S /usr/local/bin/S
EXPOSE 5150
CMD ["S"]
