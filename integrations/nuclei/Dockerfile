ARG NUCLEI_IMAGE=projectdiscovery/nuclei:v3.4.10

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY integrations/nuclei/go.mod ./
COPY integrations/nuclei ./
RUN go build -o /out/nuclei-adapter ./cmd/nuclei

FROM ${NUCLEI_IMAGE}
COPY integrations/nuclei/templates /opt/openhunter/nuclei-templates
COPY --from=build /out/nuclei-adapter /usr/local/bin/nuclei-adapter
EXPOSE 6110
# The nuclei base image sets ENTRYPOINT to the nuclei binary; override it so the
# container runs our adapter HTTP server (which shells out to nuclei itself).
ENTRYPOINT []
CMD ["nuclei-adapter"]
