#!/bin/sh
set -eu

LOG="/logs/rclone-sync.log"
REMOTE="R2:${R2_BUCKET}/postgres-backups"
LOCAL="/backups"

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG"
}

sync_backups() {
    log "--- Sync start: ${LOCAL} → ${REMOTE}"
    if rclone sync "$LOCAL" "$REMOTE" \
            --update \
            --transfers=4 \
            --log-level=INFO \
            --stats-one-line \
            --log-file="$LOG" 2>&1; then
        log "--- Sync OK"
    else
        log "--- Sync FAILED (exit $?). Local backups are intact. Retrying next cycle."
    fi
}

mkdir -p /logs
log "=== rclone-sync service started ==="
log "Remote: ${REMOTE}"

# Initial 5-minute delay to let any in-progress backup finish first
log "Waiting 5 min before first sync..."
sleep 300

while true; do
    sync_backups
    log "Sleeping 3600s until next sync..."
    sleep 3600
done
