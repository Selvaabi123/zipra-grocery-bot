#!/bin/bash
# ZIPRA SQLite hourly backup (safe WAL-consistent snapshot via sqlite3 .backup)
set -u
SRC="/Users/mohanraj/grocery-bot/data/zipra.db"
BKP="/Users/mohanraj/Library/Application Support/ZipraBackups"
KEEP=24
mkdir -p "$BKP" || { echo "$(date) backup dir create failed" >> /tmp/zipra-backup.log; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BKP/zipra-$STAMP.db"
if /usr/bin/sqlite3 "$SRC" ".backup '$OUT'"; then
  /usr/bin/sqlite3 "$OUT" "PRAGMA integrity_check;" >/tmp/zipra-backup-integrity.txt 2>&1
  if grep -q "^ok$" /tmp/zipra-backup-integrity.txt; then
    echo "$(date) backup OK: $OUT" >> /tmp/zipra-backup.log
  else
    echo "$(date) backup integrity FAIL (removing $OUT)" >> /tmp/zipra-backup.log
    rm -f "$OUT"
  fi
else
  echo "$(date) sqlite backup failed" >> /tmp/zipra-backup.log
  exit 1
fi
# prune old backups, keep the newest ${KEEP}
ls -1t "$BKP"/zipra-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r f; do rm -f "$f"; done
exit 0