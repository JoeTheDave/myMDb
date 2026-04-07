#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="sage-shared-dev-postgres"

# Check if container exists
if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  STATUS=$(docker inspect "$CONTAINER_NAME" --format '{{.State.Status}}')
  if [ "$STATUS" = "running" ]; then
    echo "✓ $CONTAINER_NAME is already running"
    exit 0
  else
    echo "→ $CONTAINER_NAME exists but is not running (status: $STATUS). Starting..."
    docker start "$CONTAINER_NAME"
    echo "✓ $CONTAINER_NAME started"
  fi
else
  echo "→ $CONTAINER_NAME does not exist. Creating and starting..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_PASSWORD=localdev123 \
    -p 5432:5432 \
    -v sage-shared-dev-postgres-data:/var/lib/postgresql/data \
    --restart unless-stopped \
    postgres:15
  echo "✓ $CONTAINER_NAME created and started"
fi

# Wait for postgres to be ready
echo "→ Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres &>/dev/null; then
    echo "✓ Postgres is ready"
    exit 0
  fi
  sleep 1
done

echo "✗ Postgres did not become ready in time"
exit 1
