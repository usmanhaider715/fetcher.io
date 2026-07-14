#!/usr/bin/env bash
# Nightly MongoDB backup — add to crontab: 0 3 * * * /var/www/fetcherio/infra/vps/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/fetcherio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE="$BACKUP_DIR/fetcherio_$STAMP.gz"

mkdir -p "$BACKUP_DIR"
mongodump --uri="${MONGODB_URI:-mongodb://127.0.0.1:27017/fetcherio}" --archive="$ARCHIVE" --gzip

find "$BACKUP_DIR" -name 'fetcherio_*.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Backup written: $ARCHIVE"
