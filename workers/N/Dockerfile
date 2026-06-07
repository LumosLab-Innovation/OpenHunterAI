FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/N/go.mod ./
COPY workers/N ./
RUN go build -o /out/N ./cmd/N

FROM alpine:3.20
COPY --from=build /out/N /usr/local/bin/N
EXPOSE 5130
CMD ["N"]
