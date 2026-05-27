FROM golang:1.22-alpine AS build
WORKDIR /src
COPY integrations/playwright/go.mod ./
COPY integrations/playwright ./
RUN go build -o /out/playwright-adapter ./cmd/playwright

FROM alpine:3.20
COPY --from=build /out/playwright-adapter /usr/local/bin/playwright-adapter
EXPOSE 6140
CMD ["playwright-adapter"]
