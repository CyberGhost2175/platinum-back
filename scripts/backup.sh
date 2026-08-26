#!/usr/bin/env sh
# Daily PostgreSQL backup. Schedule via cron, e.g.:
#   0 3 * * * /opt/platinum-back/scripts/backup.sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/platinum_${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

pg_dump \
  --host="${DB_HOST:-localhost}" \
  --port="${DB_PORT:-5432}" \
  --username="${DB_USERNAME:-platinum}" \
  --dbname="${DB_DATABASE:-platinum}" \
  --format=plain \
  | gzip > "${FILE}"

find "${BACKUP_DIR}" -name 'platinum_*.sql.gz' -mtime "+${KEEP_DAYS}" -delete

echo "Backup written: ${FILE}"
