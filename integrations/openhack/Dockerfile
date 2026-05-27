FROM golang:1.22-alpine AS build
WORKDIR /src
COPY integrations/openhack/go.mod ./
COPY integrations/openhack ./
RUN go build -o /out/openhack-adapter ./cmd/openhack

FROM alpine:3.20
COPY --from=build /out/openhack-adapter /usr/local/bin/openhack-adapter
EXPOSE 6120
CMD ["openhack-adapter"]
