#!/bin/bash
LOG=/home/z/my-project/vlm-recovery.log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking z-ai VLM availability..." >> "$LOG"
if ! ss -tlnp 2>/dev/null | grep -q ':3001'; then
    echo "[$(date)] pipeline-service not running — skipping." >> "$LOG"; exit 0
fi
JOB_STATUS=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute(\"SELECT COUNT(*) FROM Job WHERE status IN ('pending','scraping','summarizing','rendering','merging')\").fetchone()
print(r[0])
" 2>/dev/null || echo "0")
if [ "$JOB_STATUS" != "0" ]; then
    echo "[$(date)] A job is already running ($JOB_STATUS active) — skipping." >> "$LOG"; exit 0
fi
echo "[$(date)] No active jobs — VLM standby (will auto-test on next user job)." >> "$LOG"
