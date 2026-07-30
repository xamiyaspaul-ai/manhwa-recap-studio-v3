#!/bin/bash
# Checks if z-ai VLM is available (not rate-limited). If available, runs a
# test job and verifies the output video has voice. Logs results.
LOG=/home/z/my-project/vlm-recovery.log

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking z-ai VLM availability..." >> "$LOG"

# Check if mini-service is running
if ! ss -tlnp 2>/dev/null | grep -q ':3001'; then
    echo "[$(date)] pipeline-service not running — skipping." >> "$LOG"
    exit 0
fi

# Check if a job is already running
JOB_STATUS=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute(\"SELECT COUNT(*) FROM Job WHERE status IN ('pending','scraping','summarizing','rendering','merging')\").fetchone()
print(r[0])
" 2>/dev/null || echo "0")

if [ "$JOB_STATUS" != "0" ]; then
    echo "[$(date)] A job is already running ($JOB_STATUS active) — skipping." >> "$LOG"
    exit 0
fi

# Check recent 429 rate
RECENT_429S=$(tail -50 /home/z/my-project/mini-service-pipeline.log 2>/dev/null | grep -c '429' || echo "0")

if [ "$RECENT_429S" -gt 5 ]; then
    echo "[$(date)] z-ai still rate-limited ($RECENT_429S recent 429s) — waiting." >> "$LOG"
    exit 0
fi

echo "[$(date)] z-ai may be available ($RECENT_429S recent 429s) — starting test job..." >> "$LOG"

# Clear old data
/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
con.execute('DELETE FROM JobLog'); con.execute('DELETE FROM Chapter'); con.execute('DELETE FROM Job')
con.commit()
" 2>/dev/null
rm -rf /home/z/my-project/data/cache/vlm /home/z/my-project/data/jobs/* 2>/dev/null

# Start test job
RESP=$(curl -s -X POST http://localhost:3000/api/jobs -H "content-type: application/json" \
  -d '{"mangaId":"as-nano-machine","mangaTitle":"Nano Machine","coverUrl":"https://cdn.asurascans.com/asura-images/covers/nano-machine.e31bdb.webp","language":"en","chapterLimit":1,"voice":"en-US-AndrewNeural","translate":true,"useBgm":false}')
JOB_ID=$(echo "$RESP" | /home/z/.venv/bin/python3 -c "import sys,json;print(json.load(sys.stdin)['job']['id'])" 2>/dev/null)

if [ -z "$JOB_ID" ]; then
    echo "[$(date)] Failed to create test job." >> "$LOG"
    exit 0
fi

echo "[$(date)] Test job created: $JOB_ID" >> "$LOG"
echo "$JOB_ID" > /tmp/cron_test_job_id.txt

# Wait for job to complete (max 10 min)
for i in $(seq 1 20); do
    sleep 30
    STATUS=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute('SELECT status FROM Job WHERE id=?', ('$JOB_ID',)).fetchone()
print(r[0] if r else 'notfound')
" 2>/dev/null)
    if [ "$STATUS" = "done" ] || [ "$STATUS" = "error" ]; then
        break
    fi
done

# Check if output video has voice
if [ "$STATUS" = "done" ]; then
    VIDEO="/home/z/my-project/data/jobs/$JOB_ID/output/master_recap.mp4"
    if [ -f "$VIDEO" ]; then
        ffmpeg -y -v error -i "$VIDEO" -vn -ar 44100 -ac 1 /tmp/cron_check.wav 2>/dev/null
        RMS=$(/home/z/.venv/bin/python3 -c "
import wave, array, math
w = wave.open('/tmp/cron_check.wav', 'r')
n = w.getnframes()
raw = w.readframes(n)
w.close()
s = array.array('h')
s.frombytes(raw)
vals = [x/32768.0 for x in s]
rms = math.sqrt(sum(v*v for v in vals)/max(len(vals),1))
print(f'{rms:.4f}')
" 2>/dev/null)
        
        NARR_LOG=$(/home/z/.venv/bin/python3 -c "
import sqlite3
con = sqlite3.connect('/home/z/my-project/db/custom.db')
r = con.execute(\"SELECT message FROM JobLog WHERE jobId=? AND message LIKE '%transcribed:%' ORDER BY createdAt DESC LIMIT 1\", ('$JOB_ID',)).fetchone()
print(r[0] if r else 'no log')
" 2>/dev/null)
        
        HAS_VOICE=$(echo "$RMS > 0.001" | /home/z/.venv/bin/python3 -c "import sys; print('yes' if float(sys.stdin.read().split()[0])>0.001 else 'no')" 2>/dev/null || echo "unknown")
        
        if [ "$HAS_VOICE" = "yes" ]; then
            echo "[$(date)] ✓ SUCCESS! Job $JOB_ID completed with VOICE (RMS=$RMS). Audio is present!" >> "$LOG"
        else
            echo "[$(date)] ✗ Job completed but audio is SILENT (RMS=$RMS). VLM still failing." >> "$LOG"
        fi
        echo "[$(date)]   Transcription: $NARR_LOG" >> "$LOG"
    else
        echo "[$(date)] ✗ Job done but no output video found." >> "$LOG"
    fi
else
    echo "[$(date)] ✗ Job ended with status: $STATUS" >> "$LOG"
fi
