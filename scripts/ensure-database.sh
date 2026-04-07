#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="sage-shared-dev-postgres"
DB_NAME="mymdb_dev"

echo "→ Checking if database '$DB_NAME' exists in $CONTAINER_NAME..."

DB_EXISTS=$(docker exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [ "$DB_EXISTS" = "1" ]; then
  echo "✓ Database '$DB_NAME' already exists"
else
  echo "→ Creating database '$DB_NAME'..."
  docker exec "$CONTAINER_NAME" psql -U postgres -c "CREATE DATABASE $DB_NAME;"
  echo "✓ Database '$DB_NAME' created"
fi
