FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/O/go.mod ./
COPY workers/O ./
RUN go build -o /out/O ./cmd/O

FROM alpine:3.20
COPY --from=build /out/O /usr/local/bin/O
EXPOSE 5140
CMD ["O"]
