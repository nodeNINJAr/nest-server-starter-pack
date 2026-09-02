#!/bin/bash
set -e

DC="docker compose -f docker-compose.dev.yml"
APP_SERVICE="app"
DB_SERVICE="db"

if [ ! -f .env ]; then
  echo "❌ .env file not found."
  exit 1
fi

echo "🔹 Starting containers..."
$DC up -d --build

echo "🔹 Waiting for Postgres..."

MAX_RETRIES=30
count=0

until $DC exec -T $DB_SERVICE pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
    count=$((count+1))

    if [ $count -ge $MAX_RETRIES ]; then
        echo "❌ Postgres not ready"
        exit 1
    fi

    echo "⏳ Waiting... ($count/$MAX_RETRIES)"
    sleep 2
done

echo "✅ Postgres ready"

echo "🔹 Running Prisma migrations..."
$DC exec -T $APP_SERVICE npx prisma migrate deploy

echo "🔹 Generating Prisma client..."
$DC exec -T $APP_SERVICE npx prisma generate

echo "🔹 Running seed..."
$DC exec -T $APP_SERVICE npx prisma db seed

echo "🔹 Done. Attaching logs..."
$DC logs -f $APP_SERVICE