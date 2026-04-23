# Universal multi-stage Dockerfile for every Mimi microservice.
# docker-compose passes SERVICE=auth-service / users-service / ... as a build arg.
#
# Build:
#   docker build --build-arg SERVICE=auth-service -f docker/service.Dockerfile -t mimi-auth .
# Run:
#   docker run --rm -e DATABASE_URL=... -e REDIS_URL=... -e JWT_SECRET=... -p 8080:8080 mimi-auth

FROM golang:1.22-alpine AS builder

ARG SERVICE
RUN test -n "$SERVICE" || (echo "SERVICE build-arg is required" && exit 1)

WORKDIR /src
# Cache Go modules layer.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/${SERVICE}

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget
WORKDIR /app

COPY --from=builder /out/app /app/app
COPY migrations /migrations

# Healthcheck hits the service's own /healthz. docker-compose adds a more
# thorough /readyz probe for dependencies (db, redis).
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

EXPOSE 8080
ENTRYPOINT ["/app/app"]
