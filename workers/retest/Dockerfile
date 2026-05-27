FROM golang:1.22-alpine AS build
WORKDIR /src
COPY workers/retest/go.mod ./
COPY workers/retest ./
RUN go build -o /out/retest ./cmd/retest

FROM alpine:3.20
COPY --from=build /out/retest /usr/local/bin/retest
EXPOSE 5160
CMD ["retest"]
