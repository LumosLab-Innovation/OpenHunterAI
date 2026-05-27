FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/browser-inspector/go.mod ./
COPY workers/browser-inspector ./
RUN go build -o /out/browser-inspector ./cmd/browser-inspector

FROM alpine:3.20
COPY --from=build /out/browser-inspector /usr/local/bin/browser-inspector
EXPOSE 5110
CMD ["browser-inspector"]
