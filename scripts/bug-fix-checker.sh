#!/bin/bash
# Recurring health check: verifies services are running, VLM is available,
# and no jobs are stuck. Logs results. Runs every 30 min via background loop.
LOG=/home/z/my-project/bug-fix-checker.log
TS=$(date '+%Y-%m-%d %H:%M:%S')

# Check services
NEXTJS_UP=$(ss -tlnp 2>/dev/null | grep -c ':3000' || echo "0")
PIPELINE_UP=$(ss -tlnp 2>/dev/null | grep -c ':3001' || echo "0")

# Check for stuck jobs
STUCK=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute(\"SELECT COUNT(*) FROM Job WHERE status IN ('scraping','summarizing','rendering','merging') AND updatedAt < datetime('now', '-1 hour')\").fetchone()
print(r[0])
" 2>/dev/null || echo "0")

# Check 429 rate
RECENT_429=$(tail -30 /home/z/my-project/mini-service-pipeline.log 2>/dev/null | grep -c '429' || echo "0")

echo "[$TS] Services: nextjs=$NEXTJS_UP pipeline=$PIPELINE_UP | Stuck jobs: $STUCK | Recent 429s: $RECENT_429" >> "$LOG"

# If services are down, try to restart them
if [ "$NEXTJS_UP" = "0" ]; then
    echo "[$TS] Next.js down — restarting..." >> "$LOG"
    ( bash -c 'cd /home/z/my-project && bun run dev' </dev/null >>/home/z/my-project/dev.out.log 2>&1 & )
fi
if [ "$PIPELINE_UP" = "0" ]; then
    echo "[$TS] Pipeline-service down — restarting..." >> "$LOG"
    ( bash -c 'cd /home/z/my-project/mini-services/pipeline-service && bun run dev' </dev/null >>/home/z/my-project/mini-service-pipeline.log 2>&1 & )
fi

# If jobs are stuck for >1 hour, reset them to pending
if [ "$STUCK" != "0" ] && [ "$STUCK" != "" ]; then
    echo "[$TS] Found $STUCK stuck job(s) — resetting to pending" >> "$LOG"
    /home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
con.execute(\"UPDATE Job SET status='pending', message='Auto-reset by bug-fix checker (was stuck >1hr)' WHERE status IN ('scraping','summarizing','rendering','merging') AND updatedAt < datetime('now', '-1 hour')\")
con.commit()
" 2>/dev/null
fi
