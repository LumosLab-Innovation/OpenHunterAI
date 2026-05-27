FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/nuclei-signal/go.mod ./
COPY workers/nuclei-signal ./
RUN go build -o /out/nuclei-signal ./cmd/nuclei-signal

FROM alpine:3.20
COPY --from=build /out/nuclei-signal /usr/local/bin/nuclei-signal
EXPOSE 5130
CMD ["nuclei-signal"]
