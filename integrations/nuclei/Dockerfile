FROM golang:1.22-alpine AS build
WORKDIR /src
COPY integrations/nuclei/go.mod ./
COPY integrations/nuclei ./
RUN go build -o /out/nuclei-adapter ./cmd/nuclei

ARG NUCLEI_IMAGE=projectdiscovery/nuclei:v3.4.10
FROM ${NUCLEI_IMAGE}
COPY integrations/nuclei/templates /opt/openhunter/nuclei-templates
COPY --from=build /out/nuclei-adapter /usr/local/bin/nuclei-adapter
EXPOSE 6110
CMD ["nuclei-adapter"]
