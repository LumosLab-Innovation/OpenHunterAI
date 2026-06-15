FROM golang:1.26-alpine AS build
WORKDIR /src
COPY integrations/strix/go.mod ./
COPY integrations/strix ./
RUN go build -o /out/strix-adapter ./cmd/strix

FROM alpine:3.20
COPY --from=build /out/strix-adapter /usr/local/bin/strix-adapter
EXPOSE 6130
CMD ["strix-adapter"]
