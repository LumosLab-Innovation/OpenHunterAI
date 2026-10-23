ARG SUBFINDER_IMAGE=projectdiscovery/subfinder:v2.16.0
ARG DNSX_IMAGE=projectdiscovery/dnsx:v1.3.0
ARG HTTPX_IMAGE=projectdiscovery/httpx:v1.10.0
ARG KATANA_IMAGE=projectdiscovery/katana:v1.7.0

# Raw toolset, no adapter wrapper — for manually poking at the four
# upstream binaries directly. The real adapter image (integrations/recon/Dockerfile)
# bundles these the same way and fronts them with the HTTP adapter.
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=projectdiscovery/subfinder:v2.16.0 /usr/local/bin/subfinder /usr/local/bin/subfinder
COPY --from=projectdiscovery/dnsx:v1.3.0 /usr/local/bin/dnsx /usr/local/bin/dnsx
COPY --from=projectdiscovery/httpx:v1.10.0 /usr/local/bin/httpx /usr/local/bin/httpx
COPY --from=projectdiscovery/katana:v1.7.0 /usr/local/bin/katana /usr/local/bin/katana
ENTRYPOINT ["/bin/sh"]
