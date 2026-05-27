FROM golang:1.22-alpine AS build
WORKDIR /src
COPY integrations/nuclei/go.mod ./
COPY integrations/nuclei ./
RUN go build -o /out/nuclei-adapter ./cmd/nuclei

FROM projectdiscovery/nuclei:latest
COPY --from=build /out/nuclei-adapter /usr/local/bin/nuclei-adapter
EXPOSE 6110
CMD ["nuclei-adapter"]
