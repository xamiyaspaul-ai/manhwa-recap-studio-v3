#!/bin/bash
# Bug-finder cron: checks for common issues and auto-fixes them.
# Runs every 30 min via background loop.
LOG=/home/z/my-project/bug-finder.log
TS=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TS] Bug check starting..." >> "$LOG"

# 1. Check if services are running, restart if down
NEXTJS=$(ss -tlnp 2>/dev/null | grep -c ':3000' || echo "0")
PIPELINE=$(ss -tlnp 2>/dev/null | grep -c ':3001' || echo "0")

if [ "$NEXTJS" = "0" ]; then
    echo "[$TS] Next.js down — restarting" >> "$LOG"
    ( bash -c 'cd /home/z/my-project && bun run dev' </dev/null >>/home/z/my-project/dev.out.log 2>&1 & )
fi
if [ "$PIPELINE" = "0" ]; then
    echo "[$TS] Pipeline-service down — restarting" >> "$LOG"
    ( bash -c 'cd /home/z/my-project/mini-services/pipeline-service && bun run dev' </dev/null >>/home/z/my-project/mini-service-pipeline.log 2>&1 & )
fi

# 2. Check for stuck jobs (>1 hour in active state)
STUCK=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute(\"SELECT COUNT(*) FROM Job WHERE status IN ('scraping','summarizing','rendering','merging') AND updatedAt < datetime('now', '-1 hour')\").fetchone()
print(r[0])
" 2>/dev/null || echo "0")

if [ "$STUCK" != "0" ] && [ "$STUCK" != "" ]; then
    echo "[$TS] Found $STUCK stuck job(s) — resetting to pending" >> "$LOG"
    /home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
con.execute(\"UPDATE Job SET status='pending', message='Auto-reset by bug-finder (stuck >1hr)' WHERE status IN ('scraping','summarizing','rendering','merging') AND updatedAt < datetime('now', '-1 hour')\")
con.commit()
" 2>/dev/null
fi

# 3. Check disk space
DISK_PCT=$(df / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%')
if [ -n "$DISK_PCT" ] && [ "$DISK_PCT" -gt 90 ]; then
    echo "[$TS] Disk at ${DISK_PCT}% — cleaning up old job data" >> "$LOG"
    find /home/z/my-project/data/jobs -maxdepth 1 -type d -mtime +3 -exec rm -rf {} \; 2>/dev/null
    rm -rf /home/z/my-project/data/cache/vlm 2>/dev/null
fi

# 4. Check Python deps (sandbox resets them)
DEPS=$(/home/z/.venv/bin/python3 -c "import edge_tts" 2>&1)
if echo "$DEPS" | grep -q "ModuleNotFoundError"; then
    echo "[$TS] Python deps missing — auto-reinstalling" >> "$LOG"
    /home/z/.venv/bin/python3 -m pip install --no-cache-dir --quiet edge-tts openai Pillow opencv-python-headless numpy huggingface-hub 2>/dev/null
    /home/z/.venv/bin/python3 -m pip install --no-cache-dir --quiet --index-url https://download.pytorch.org/whl/cpu torch torchvision 2>/dev/null
    /home/z/.venv/bin/python3 -m pip install --no-cache-dir --quiet ultralytics 2>/dev/null
fi

# 5. Check for errors in recent logs
RECENT_ERRORS=$(tail -100 /home/z/my-project/mini-service-pipeline.log 2>/dev/null | grep -ci 'error\|crash\|fatal' || echo "0")
echo "[$TS] Services: nextjs=$NEXTJS pipeline=$PIPELINE | Stuck: $STUCK | Disk: ${DISK_PCT}% | Recent errors: $RECENT_ERRORS" >> "$LOG"
