#!/bin/bash
# =============================================================================
# setup-oracle.sh — One-command setup for Oracle Cloud Free Tier VM.
#
# Installs EVERYTHING needed to run Manhwa Recap Studio 24/7 for free:
#   - Bun (JavaScript runtime)
#   - Python 3 + all ML deps (torch, ultralytics, edge-tts, opencv, ffmpeg)
#   - Caddy (reverse proxy, port 80)
#   - The app (Next.js + pipeline-service)
#   - SQLite database (local, no external DB needed)
#
# Usage (run on the Oracle VM as ubuntu user):
#   curl -sSL https://raw.githubusercontent.com/zainrana558/manhwa-recap-studio-v3/main/scripts/setup-oracle.sh | bash
#
# Or if you've cloned the repo:
#   bash scripts/setup-oracle.sh
#
# After setup, the app runs at: http://YOUR_VM_PUBLIC_IP
# =============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Manhwa Recap Studio — Oracle Cloud Setup (Automated)       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check we're on Ubuntu
if ! command -v apt &> /dev/null; then
    echo "ERROR: This script requires Ubuntu. You appear to be on a different OS."
    exit 1
fi

# Check we're not root (Oracle VMs use ubuntu user)
if [ "$EUID" -eq 0 ]; then
    echo "Please run as the 'ubuntu' user, not root."
    echo "Run: bash setup-oracle.sh"
    exit 1
fi

echo "=== Step 1/9: System updates ==="
sudo apt-get update -qq && sudo apt-get upgrade -y -qq
echo "✓ System updated"

echo ""
echo "=== Step 1.5/9: Checking RAM / swap ==="
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
SWAP_ACTIVE=$(swapon --show | wc -l)
if [ "$TOTAL_MEM_MB" -lt 4000 ] && [ "$SWAP_ACTIVE" -eq 0 ]; then
    echo "  Low RAM detected (${TOTAL_MEM_MB}MB) with no swap — adding 4GB swapfile"
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    echo "✓ Swap added"
else
    echo "✓ RAM/swap OK (${TOTAL_MEM_MB}MB RAM, swap active: $SWAP_ACTIVE)"
fi

echo ""
echo "=== Step 2/9: Adding Caddy repository ==="
if ! command -v caddy &> /dev/null; then
    sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    sudo apt-get update -qq
    echo "✓ Caddy repo added"
else
    echo "✓ Caddy already installed, skipping repo setup"
fi

echo ""
echo "=== Step 3/9: Installing ffmpeg + system deps ==="
sudo apt-get install -y -qq ffmpeg python3 python3-pip python3-venv git curl caddy
echo "✓ ffmpeg + Python + Caddy installed"

echo ""
echo "=== Step 4/9: Installing Bun ==="
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
echo "✓ Bun installed: $(bun --version)"

echo ""
echo "=== Step 5/9: Cloning the repo ==="
if [ -d "$HOME/manhwa-recap-studio-v3" ]; then
    cd "$HOME/manhwa-recap-studio-v3"
    git pull -q
    echo "✓ Repo updated"
else
    cd "$HOME"
    git clone https://github.com/zainrana558/manhwa-recap-studio-v3.git
    cd manhwa-recap-studio-v3
    echo "✓ Repo cloned"
fi

echo ""
echo "=== Step 6/9: Installing JavaScript dependencies ==="
bun install
cd mini-services/pipeline-service
bun install
cd ../..
echo "✓ JS deps installed"

echo ""
echo "=== Step 7/9: Installing Python ML dependencies ==="
python3 -m venv "$HOME/.venv"
source "$HOME/.venv/bin/activate"
pip install --upgrade pip -q
pip install edge-tts openai Pillow opencv-python-headless numpy huggingface-hub -q
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu -q
pip install ultralytics -q
echo 'source "$HOME/.venv/bin/activate"' >> ~/.bashrc
echo "✓ Python deps installed"

# Pre-download YOLO model
echo "  Pre-downloading YOLO model..."
python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>/dev/null || true
echo "✓ YOLO model cached"

echo ""
echo "=== Step 8/9: Setting up database + .env ==="
# Create .env with local SQLite (no external DB needed on Oracle VM)
cat > .env << 'ENVFILE'
DATABASE_URL=file:/home/ubuntu/manhwa-recap-studio-v3/db/custom.db
PYTHON_BIN=/home/ubuntu/.venv/bin/python3
DATA_DIR=/home/ubuntu/manhwa-recap-studio-v3/data
PROJECT_ROOT=/home/ubuntu/manhwa-recap-studio-v3
ENVFILE

cp .env mini-services/pipeline-service/.env

# Create directories
mkdir -p db data/jobs data/cache data/bgm download

# Push schema to create tables
bun run db:push 2>&1 | tail -3
echo "✓ Database created"

echo ""
echo "=== Step 9/9: Building Next.js for production ==="
bun run build 2>&1 | tail -5
echo "✓ Next.js built"

# =============================================================================
# Create startup scripts
# =============================================================================

echo ""
echo "=== Creating startup scripts ==="

# Main start script — starts all 3 services
cat > "$HOME/manhwa-recap-studio-v3/start.sh" << 'STARTSCRIPT'
#!/bin/bash
# start.sh — Starts all services on Oracle Cloud VM.
# Next.js (port 3000) + pipeline-service (port 3001) + Caddy (port 80)

set -e
cd "$(dirname "$0")"

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
source "$HOME/.venv/bin/activate"

echo "🚀 Starting Manhwa Recap Studio..."
echo ""

# Kill any existing processes
pkill -f "next-server" 2>/dev/null || true
pkill -f "pipeline-service" 2>/dev/null || true
pkill -f "index.ts" 2>/dev/null || true
sleep 2

# Start pipeline-service (port 3001)
echo "▶ Starting pipeline-service (port 3001)..."
cd mini-services/pipeline-service
nohup bun run start > /home/ubuntu/manhwa-recap-studio-v3/pipeline.log 2>&1 &
PIPELINE_PID=$!
cd ../..

# Start Next.js (port 3000)
echo "▶ Starting Next.js (port 3000)..."
nohup bun .next/standalone/server.js > /home/ubuntu/manhwa-recap-studio-v3/nextjs.log 2>&1 &
NEXT_PID=$!

# Wait for services to start
sleep 5

# Check if they're running
if curl -s http://localhost:3001/internal/health | grep -q "ok"; then
    echo "✅ Pipeline-service is running (PID: $PIPELINE_PID)"
else
    echo "⚠️  Pipeline-service may not be ready yet (check pipeline.log)"
fi

if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then
    echo "✅ Next.js is running (PID: $NEXT_PID)"
else
    echo "⚠️  Next.js may not be ready yet (check nextjs.log)"
fi

# Get public IP
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "YOUR_VM_IP")
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎉  Manhwa Recap Studio is running!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  🌐 Website:  http://$PUBLIC_IP"
echo "  📊 API:      http://$PUBLIC_IP/api/stats"
echo "  🔧 Pipeline: http://$PUBLIC_IP:3001/internal/health"
echo ""
echo "  To stop:     pkill -f 'next-server|index.ts'"
echo "  To restart:  bash start.sh"
echo "  Logs:        tail -f nextjs.log pipeline.log"
echo ""
echo "═══════════════════════════════════════════════════════════════"
STARTSCRIPT
chmod +x start.sh

# Caddyfile for reverse proxy (port 80 → 3000, port 3001 for socket.io)
cat > Caddyfile.oracle << 'CADDYFILE'
:80 {
	@transform_port_query {
		query XTransformPort=*
	}

	handle @transform_port_query {
		reverse_proxy localhost:{query.XTransformPort} {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}

	handle {
		reverse_proxy localhost:3000 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}
}
CADDYFILE

# Configure Caddy
sudo cp Caddyfile.oracle /etc/caddy/Caddyfile
sudo systemctl restart caddy 2>/dev/null || sudo caddy start --config /etc/caddy/Caddyfile --adapter caddyfile &

# Create systemd service for auto-restart on reboot
sudo tee /etc/systemd/system/manhwa-recap.service > /dev/null << 'SERVICE'
[Unit]
Description=Manhwa Recap Studio
After=network.target

[Service]
Type=forking
User=ubuntu
WorkingDirectory=/home/ubuntu/manhwa-recap-studio-v3
ExecStart=/bin/bash /home/ubuntu/manhwa-recap-studio-v3/start.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable manhwa-recap 2>/dev/null || true

# =============================================================================
# Open firewall ports
# =============================================================================
echo ""
echo "=== Opening firewall ports ==="
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true
echo "✓ Firewall ports opened (80, 443, 3000, 3001)"

# =============================================================================
# Done!
# =============================================================================
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "YOUR_VM_IP")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP COMPLETE!                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                              ║"
echo "║  Your app is now running 24/7 on Oracle Cloud!              ║"
echo "║                                                              ║"
echo "║  🌐 Website:  http://$PUBLIC_IP"
echo "║  📊 API:      http://$PUBLIC_IP/api/stats"
echo "║  🔧 Pipeline: http://$PUBLIC_IP:3001/internal/health"
echo "║                                                              ║"
echo "║  The app will auto-restart if the VM reboots.               ║"
echo "║                                                              ║"
echo "║  Commands:                                                   ║"
echo "║    Stop:     sudo systemctl stop manhwa-recap                ║"
echo "║    Start:    sudo systemctl start manhwa-recap               ║"
echo "║    Restart:  sudo systemctl restart manhwa-recap             ║"
echo "║    Status:   sudo systemctl status manhwa-recap              ║"
echo "║    Logs:     tail -f ~/manhwa-recap-studio-v3/nextjs.log    ║"
echo "║              tail -f ~/manhwa-recap-studio-v3/pipeline.log  ║"
echo "║                                                              ║"
echo "║  ⚠️  Oracle Cloud Security List:                             ║"
echo "║  Make sure ports 80, 443, 3000, 3001 are open in:           ║"
echo "║  VCN → Security Lists → Default Security List               ║"
echo "║  Add Ingress Rules for TCP 80, 443, 3000, 3001             ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Start the services
echo "=== Starting services... ==="
bash start.sh
