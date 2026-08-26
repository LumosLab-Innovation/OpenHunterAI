ARG SUBFINDER_IMAGE=projectdiscovery/subfinder:v2.16.0
ARG DNSX_IMAGE=projectdiscovery/dnsx:v1.3.0
ARG HTTPX_IMAGE=projectdiscovery/httpx:v1.10.0
ARG KATANA_IMAGE=projectdiscovery/katana:v1.7.0

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY integrations/recon/go.mod ./
COPY integrations/recon ./
RUN go build -o /out/recon-adapter ./cmd/recon

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=projectdiscovery/subfinder:v2.16.0 /usr/local/bin/subfinder /usr/local/bin/subfinder
COPY --from=projectdiscovery/dnsx:v1.3.0 /usr/local/bin/dnsx /usr/local/bin/dnsx
COPY --from=projectdiscovery/httpx:v1.10.0 /usr/local/bin/httpx /usr/local/bin/httpx
COPY --from=projectdiscovery/katana:v1.7.0 /usr/local/bin/katana /usr/local/bin/katana
RUN adduser -D -u 10001 adapter
USER adapter
COPY --from=build /out/recon-adapter /usr/local/bin/recon-adapter
EXPOSE 6140
CMD ["recon-adapter"]
