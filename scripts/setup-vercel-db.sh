#!/bin/bash
# =============================================================================
# setup-vercel-db.sh — Automated database setup for Vercel deployment.
#
# Supports two databases:
#   1. Supabase (PostgreSQL, 500 MB free) — recommended, more features
#   2. Turso (SQLite, 9 GB free) — simpler, no schema changes
#
# This script:
#   1. Helps you create the database (Supabase or Turso)
#   2. Swaps the Prisma schema to the correct provider
#   3. Pushes the schema to create tables
#   4. Generates the Prisma client
#   5. Prints ALL environment variables you need to paste into Vercel
#
# Usage:
#   bash scripts/setup-vercel-db.sh
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Manhwa Recap Studio — Vercel Database Setup              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "Choose your database:"
echo "  1. Supabase (PostgreSQL, 500 MB free) — recommended, full-featured"
echo "  2. Turso (SQLite, 9 GB free) — simpler, zero schema changes"
echo ""
read -p "Enter 1 or 2: " CHOICE

if [ "$CHOICE" = "1" ]; then
  # ===========================================================================
  # SUPABASE
  # ===========================================================================
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  SUPABASE SETUP (PostgreSQL)"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Step 1: Create a free Supabase project"
  echo "  1. Go to https://supabase.com → Sign up (free, no credit card)"
  echo "  2. Click 'New Project'"
  echo "  3. Name it 'manhwa-recap'"
  echo "  4. Set a database password (save it!)"
  echo "  5. Choose a region close to you"
  echo "  6. Wait ~2 min for it to provision"
  echo ""
  echo "Step 2: Get your connection string"
  echo "  1. In Supabase dashboard → Project Settings → Database"
  echo "  2. Find 'Connection string' → 'URI'"
  echo "  3. It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"
  echo ""
  read -p "Paste your Supabase connection string: " SUPABASE_URL

  if [ -z "$SUPABASE_URL" ]; then
    echo "ERROR: No URL provided"
    exit 1
  fi

  echo ""
  echo "Step 3: Swapping Prisma schema to PostgreSQL..."
  cp prisma/schema.prisma prisma/schema.sqlite.bak
  cp prisma/schema.supabase.prisma prisma/schema.prisma
  echo "  ✓ Schema swapped to PostgreSQL"
  echo "  (Original SQLite schema saved as prisma/schema.sqlite.bak)"

  echo ""
  echo "Step 4: Pushing schema to Supabase (creating tables)..."
  export DATABASE_URL="$SUPABASE_URL"
  bun run db:push 2>&1 | tail -5

  echo ""
  echo "Step 5: Generating Prisma client..."
  bunx prisma generate 2>&1 | tail -3

  # Also sync the mini-service schema
  echo ""
  echo "Step 6: Syncing mini-service schema..."
  cp prisma/schema.prisma mini-services/pipeline-service/prisma/schema.prisma
  cd mini-services/pipeline-service
  bunx prisma generate 2>&1 | tail -3
  cd "$PROJECT_DIR"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ SUPABASE SETUP COMPLETE!"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Paste these environment variables into Vercel:"
  echo "(Settings → Environment Variables → Add each one)"
  echo ""
  echo "┌─────────────────────────────────────────────────────────────┐"
  echo "│ REQUIRED:                                                   │"
  echo "│                                                             │"
  echo "│  DATABASE_URL = $SUPABASE_URL"
  echo "│                                                             │"
  echo "│  PIPELINE_SERVICE_URL = http://YOUR_LAPTOP_IP:3001         │"
  echo "│    (or your Cloudflare Tunnel URL)                          │"
  echo "│                                                             │"
  echo "│  NEXT_PUBLIC_PIPELINE_SERVICE_URL = (same as above)        │"
  echo "│                                                             │"
  echo "│ VLM KEYS (at least one):                                    │"
  echo "│  GROQ_API_KEY = gsk_...  (console.groq.com/keys)           │"
  echo "│  GEMINI_API_KEY = AIza...  (aistudio.google.com/apikey)    │"
  echo "│                                                             │"
  echo "│ OPTIONAL (cloud archive):                                   │"
  echo "│  MEGA_EMAIL = your@email.com                               │"
  echo "│  MEGA_PASSWORD = your_mega_password                        │"
  echo "│  AUTO_ARCHIVE = true                                       │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  echo "Next steps:"
  echo "  1. Add the env vars above to Vercel"
  echo "  2. Redeploy on Vercel"
  echo "  3. On your laptop, set the same DATABASE_URL + run the pipeline-service"
  echo ""

elif [ "$CHOICE" = "2" ]; then
  # ===========================================================================
  # TURSO
  # ===========================================================================
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  TURSO SETUP (SQLite)"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Step 1: Install Turso CLI"
  if ! command -v turso &> /dev/null; then
    echo "  Installing Turso CLI..."
    curl -sSfL https://get.tur.so/install.sh | bash
    export PATH="$HOME/.turso/bin:$PATH"
  fi
  echo "  ✓ Turso CLI installed"

  echo ""
  echo "Step 2: Login to Turso"
  turso auth login
  echo "  ✓ Logged in"

  echo ""
  echo "Step 3: Creating database..."
  turso db create manhwa-recap 2>&1 || echo "  (Database may already exist, continuing...)"
  echo "  ✓ Database created"

  echo ""
  echo "Step 4: Getting connection info..."
  TURSO_URL=$(turso db show manhwa-recap --url)
  TURSO_TOKEN=$(turso db tokens create manhwa-recap)
  echo "  URL: $TURSO_URL"
  echo "  Token: ${TURSO_TOKEN:0:20}..."

  echo ""
  echo "Step 5: Pushing schema to Turso..."
  export DATABASE_URL="$TURSO_URL"
  export DATABASE_AUTH_TOKEN="$TURSO_TOKEN"
  bun run db:push 2>&1 | tail -5

  echo ""
  echo "Step 6: Generating Prisma client..."
  bunx prisma generate 2>&1 | tail -3

  # Sync mini-service
  echo ""
  echo "Step 7: Syncing mini-service..."
  cp prisma/schema.prisma mini-services/pipeline-service/prisma/schema.prisma
  cd mini-services/pipeline-service
  bunx prisma generate 2>&1 | tail -3
  cd "$PROJECT_DIR"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ TURSO SETUP COMPLETE!"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Paste these environment variables into Vercel:"
  echo ""
  echo "┌─────────────────────────────────────────────────────────────┐"
  echo "│ REQUIRED:                                                   │"
  echo "│                                                             │"
  echo "│  DATABASE_URL = $TURSO_URL"
  echo "│  DATABASE_AUTH_TOKEN = $TURSO_TOKEN"
  echo "│                                                             │"
  echo "│  PIPELINE_SERVICE_URL = http://YOUR_LAPTOP_IP:3001         │"
  echo "│  NEXT_PUBLIC_PIPELINE_SERVICE_URL = (same as above)        │"
  echo "│                                                             │"
  echo "│ VLM KEYS (at least one):                                    │"
  echo "│  GROQ_API_KEY = gsk_...  (console.groq.com/keys)           │"
  echo "│  GEMINI_API_KEY = AIza...  (aistudio.google.com/apikey)    │"
  echo "│                                                             │"
  echo "│ OPTIONAL (cloud archive):                                   │"
  echo "│  MEGA_EMAIL = your@email.com                               │"
  echo "│  MEGA_PASSWORD = your_mega_password                        │"
  echo "│  AUTO_ARCHIVE = true                                       │"
  echo "└─────────────────────────────────────────────────────────────┘"
  echo ""
  echo "Next steps:"
  echo "  1. Add the env vars above to Vercel"
  echo "  2. Redeploy on Vercel"
  echo "  3. On your laptop, set the same DATABASE_URL + DATABASE_AUTH_TOKEN"
  echo "     and run the pipeline-service"
  echo ""

else
  echo "Invalid choice. Run again and enter 1 or 2."
  exit 1
fi

echo ""
echo "For the pipeline-service on your laptop, create a .env file with:"
echo "  DATABASE_URL=<same value as Vercel>"
echo "  DATABASE_AUTH_TOKEN=<same value as Vercel, if using Turso>"
echo ""
echo "Then start the pipeline-service:"
echo "  cd mini-services/pipeline-service"
echo "  bun run dev"
echo ""
echo "And expose it to the internet:"
echo "  cloudflared tunnel --url http://localhost:3001"
echo ""
echo "🎉 Done! Your Vercel site + laptop pipeline-service share the same database."
