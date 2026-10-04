#!/bin/bash
set -e

echo "Waiting for database…"
until python -c "
import psycopg
import os
import time
url = os.environ.get('DATABASE_URL', '')
# Convert SQLAlchemy URL to psycopg connstr
url = url.replace('postgresql+psycopg://', 'postgresql://')
try:
    psycopg.connect(url).close()
    print('DB ready')
except Exception as e:
    print(f'DB not ready: {e}')
    exit(1)
"; do
  sleep 2
done

echo "Running migrations…"
alembic upgrade head

if [ "${SEED_ON_START}" = "true" ]; then
  echo "Seeding…"
  python -m seed.run
fi

echo "Starting uvicorn on port ${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
