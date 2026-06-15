FROM golang:1.26-alpine AS build
WORKDIR /src
COPY integrations/zaproxy/go.mod ./
COPY integrations/zaproxy ./
RUN go build -o /out/zaproxy-adapter ./cmd/zaproxy

FROM alpine:3.20
COPY --from=build /out/zaproxy-adapter /usr/local/bin/zaproxy-adapter
EXPOSE 6100
CMD ["zaproxy-adapter"]
