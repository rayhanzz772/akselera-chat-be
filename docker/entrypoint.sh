#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
RETRIES=30
until npx sequelize-cli db:migrate:status > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  RETRIES=$((RETRIES - 1))
  echo "[entrypoint] Database not ready, retrying... ($RETRIES left)"
  sleep 2
done

echo "[entrypoint] Running migrations..."
npx sequelize-cli db:migrate

# Only run seeders if the directory exists and contains .js files
if [ -d "./db/seeders" ] && ls ./db/seeders/*.js > /dev/null 2>&1; then
  echo "[entrypoint] Running seeders..."
  npx sequelize-cli db:seed:all
else
  echo "[entrypoint] No seeders found, skipping."
fi

echo "[entrypoint] Starting application..."
exec "$@"
