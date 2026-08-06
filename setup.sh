#!/usr/bin/env bash
#
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Manhwa Recap Studio v3 — One-Click Oracle Cloud Setup Script   ║
# ║                                                                  ║
# ║  Run after cloning:                                              ║
# ║    git clone <repo-url> manhwa-recap-studio                      ║
# ║    cd manhwa-recap-studio                                        ║
# ║    chmod +x setup.sh && ./setup.sh                               ║
# ║                                                                  ║
# ║  What it does:                                                   ║
# ║    1. Installs system packages (ffmpeg, Caddy, etc.)              ║
# ║    2. Installs Bun runtime                                       ║
# ║    3. Installs Ollama + pulls lightweight LLMs                   ║
# ║    4. Sets up Python venv with all ML deps                       ║
# ║    5. Installs Node.js/Bun deps for both projects                ║
# ║    6. Configures Prisma + SQLite database                        ║
# ║    7. Creates .env from .env.example                             ║
# ║    8. Installs systemd services for auto-start on boot           ║
# ║    9. Configures Oracle Cloud firewall (iptables)                ║
#   10. Starts all services                                          ║
# ╚══════════════════════════════════════════════════════════════════╝
#
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1" >&2; }
log_step()  { echo -e "${BLUE}${BOLD}[STEP $1]${NC} $2"; }

# ── Guard: must run from project root ────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f "package.json" ]]; then
    log_error "package.json not found. Run this script from the project root."
    exit 1
fi

echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║     Manhwa Recap Studio v3 — Setup Script        ║"
echo "  ║     Oracle Cloud Auto-Configuration               ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Configuration ─────────────────────────────────────────────────────────────
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-qwen2.5-vl:7b}"
OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3.2:3b}"
PORT_WEB=3000
PORT_PIPELINE=3001
PORT_CADDY=80
PROJECT_DIR="$(pwd)"

# ── Detect OS ─────────────────────────────────────────────────────────────────
detect_os() {
    if [[ -f /etc/oracle-release ]]; then
        echo "oracle"
    elif [[ -f /etc/lsb-release ]] && grep -q "Ubuntu" /etc/lsb-release 2>/dev/null; then
        echo "ubuntu"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    elif [[ -f /etc/redhat-release ]]; then
        echo "rhel"
    elif [[ -f /etc/amazon-linux-release ]]; then
        echo "amazon"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
log_info "Detected OS: $OS"

# ── Package manager detection ─────────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
    PKG_UPDATE="sudo apt-get update -qq"
    PKG_INSTALL="sudo apt-get install -y -qq"
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    PKG_UPDATE="sudo dnf update -q"
    PKG_INSTALL="sudo dnf install -y -q"
elif command -v yum &>/dev/null; then
    PKG_MGR="yum"
    PKG_UPDATE="sudo yum update -q"
    PKG_INSTALL="sudo yum install -y -q"
else
    log_error "No supported package manager found (apt/dnf/yum)"
    exit 1
fi

log_info "Package manager: $PKG_MGR"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: System Packages
# ═══════════════════════════════════════════════════════════════════════════════
log_step 1 "Installing system packages..."

$PKG_UPDATE

# Common system packages
SYSTEM_PACKAGES=(
    curl
    wget
    git
    unzip
    build-essential
    # Video processing
    ffmpeg
    # Python
    python3
    python3-pip
    python3-venv
    python3-dev
    # Image processing
    libgl1
    libglib2.0-0
    # TLS for Caddy
    libcap2-bin
    # Misc
    ca-certificates
    gnupg
    lsb-release
    jq
    sqlite3
    tmux
    htop
)

# OS-specific packages
if [[ "$OS" == "oracle" || "$OS" == "rhel" || "$OS" == "amazon" ]]; then
    # On RHEL-like systems, some package names differ
    SYSTEM_PACKAGES_RHEL=(
        gcc
        gcc-c++
        make
        mesa-libGL
        glib2
    )
    $PKG_INSTALL ${SYSTEM_PACKAGES_RHEL[@]} 2>/dev/null || true
fi

$PKG_INSTALL ${SYSTEM_PACKAGES[@]} 2>/dev/null || {
    log_warn "Some system packages failed to install — continuing anyway"
}

log_info "System packages installed"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Bun Runtime
# ═══════════════════════════════════════════════════════════════════════════════
log_step 2 "Installing Bun runtime..."

if command -v bun &>/dev/null; then
    BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
    log_info "Bun already installed (v$BUN_VERSION)"
else
    curl -fsSL https://bun.sh/install | bash
    # Source bun into current shell
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    log_info "Bun installed: $(bun --version)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Ollama + Local LLMs
# ═══════════════════════════════════════════════════════════════════════════════
log_step 3 "Installing Ollama + local LLM models..."

if command -v ollama &>/dev/null; then
    log_info "Ollama already installed: $(ollama --version 2>/dev/null | head -1)"
else
    log_info "Downloading Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    log_info "Ollama installed"
fi

# Start Ollama service if not running
if ! pgrep -x ollama &>/dev/null; then
    if command -v systemctl &>/dev/null; then
        sudo systemctl start ollama 2>/dev/null || {
            # Fallback: start manually in background
            ollama serve &
            sleep 3
        }
    else
        ollama serve &
        sleep 3
    fi
    log_info "Ollama service started"
else
    log_info "Ollama service already running"
fi

# Pull vision model (for panel text transcription)
log_info "Pulling vision model: $OLLAMA_VISION_MODEL (this may take a few minutes on first run)..."
if ollama list 2>/dev/null | grep -q "$OLLAMA_VISION_MODEL"; then
    log_info "Vision model '$OLLAMA_VISION_MODEL' already pulled"
else
    ollama pull "$OLLAMA_VISION_MODEL" && log_info "Vision model '$OLLAMA_VISION_MODEL' ready" || log_warn "Failed to pull vision model — you can pull it later with: ollama pull $OLLAMA_VISION_MODEL"
fi

# Pull text model (for narrative rewriting)
log_info "Pulling text model: $OLLAMA_TEXT_MODEL..."
if ollama list 2>/dev/null | grep -q "$OLLAMA_TEXT_MODEL"; then
    log_info "Text model '$OLLAMA_TEXT_MODEL' already pulled"
else
    ollama pull "$OLLAMA_TEXT_MODEL" && log_info "Text model '$OLLAMA_TEXT_MODEL' ready" || log_warn "Failed to pull text model — you can pull it later with: ollama pull $OLLAMA_TEXT_MODEL"
fi

log_info "Ollama models ready:"
ollama list 2>/dev/null | tail -n +2 | while read -r line; do
    log_info "  $line"
done

# ═══════════════════════════════════════════════════════════════════
# STEP 4: Python Virtual Environment + ML Dependencies
# ═══════════════════════════════════════════════════════════════════
log_step 4 "Setting up Python venv + ML dependencies..."

if [[ -d ".venv" ]]; then
    log_info "Python venv already exists"
else
    python3 -m venv .venv
    log_info "Created Python venv"
fi

source .venv/bin/activate

log_info "Installing Python dependencies from pipeline/requirements.txt..."
pip install --upgrade pip setuptools wheel -q
pip install -r pipeline/requirements.txt 2>&1 | tail -5

# Verify critical imports
log_info "Verifying Python environment..."
python3 -c "
import edge_tts; print(f'  edge-tts: {edge_tts.__version__}')
import openai; print(f'  openai: {openai.__version__}')
import PIL; print(f'  Pillow: {PIL.__version__}')
import cv2; print(f'  opencv: {cv2.__version__}')
import numpy; print(f'  numpy: {numpy.__version__}')
import torch; print(f'  torch: {torch.__version__}')
import ultralytics; print(f'  ultralytics: {ultralytics.__version__}')
print('  All Python deps OK ✓')
" || log_warn "Some Python imports failed — check the output above"

# ═══════════════════════════════════════════════════════════════════
# STEP 5: Node.js / Bun Dependencies
# ═══════════════════════════════════════════════════════════════════
log_step 5 "Installing Node.js/Bun dependencies..."

log_info "Installing main project dependencies..."
bun install 2>&1 | tail -3

log_info "Installing pipeline-service dependencies..."
(cd mini-services/pipeline-service && bun install 2>&1 | tail -3)

# ═══════════════════════════════════════════════════════════════════
# STEP 6: Database Setup (Prisma + SQLite)
# ═══════════════════════════════════════════════════════════════════
log_step 6 "Setting up database (Prisma + SQLite)..."

mkdir -p db

# Create .env if not exists
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        log_info "Created .env from .env.example"
    else
        cat > .env << 'ENVEOF'
# Manhwa Recap Studio v3 — Environment Configuration
# Database
DATABASE_URL=file:./db/custom.db

# Ollama (local LLMs — free, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=qwen2.5-vl:7b
OLLAMA_TEXT_MODEL=llama3.2:3b

# Optional: External VLM providers for faster transcription
# GROQ_API_KEY=
# GEMINI_API_KEY=
# OPENROUTER_API_KEY=
# OPENAI_API_KEY=
ENVEOF
        log_info "Created .env with defaults"
    fi
else
    log_info ".env already exists — not overwriting"
fi

# Ensure Ollama config is in .env
if ! grep -q "OLLAMA_BASE_URL" .env 2>/dev/null; then
    cat >> .env << 'ENVEOF'

# Ollama (local LLMs — free, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=qwen2.5-vl:7b
OLLAMA_TEXT_MODEL=llama3.2:3b
ENVEOF
    log_info "Added Ollama config to .env"
fi

# Push Prisma schema
bunx prisma db push --accept-data-loss 2>&1 | tail -3
log_info "Database ready"

# ═══════════════════════════════════════════════════════════════════
# STEP 7: Caddy Reverse Proxy
# ═══════════════════════════════════════════════════════════════════
log_step 7 "Setting up Caddy reverse proxy..."

if command -v caddy &>/dev/null; then
    log_info "Caddy already installed: $(caddy version | head -1)"
else
    log_info "Installing Caddy..."
    if [[ "$PKG_MGR" == "apt" ]]; then
        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https -qq 2>/dev/null
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y -qq caddy 2>/dev/null
    elif [[ "$PKG_MGR" == "dnf" || "$PKG_MGR" == "yum" ]]; then
        sudo dnf install -y 'dnf-command(copr)' 2>/dev/null
        sudo dnf copr enable @caddy/caddy -y 2>/dev/null
        sudo dnf install -y caddy 2>/dev/null
    fi
fi

if command -v caddy &>/dev/null; then
    log_info "Caddy installed: $(caddy version | head -1)"
else
    log_warn "Caddy installation may have failed — web traffic will use port 3000 directly"
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 8: Systemd Services (auto-start on boot)
# ═══════════════════════════════════════════════════════════════════
log_step 8 "Installing systemd services..."

if command -v systemctl &>/dev/null; then
    # Create service files
    
    # ── Next.js App Service ──
    sudo tee /etc/systemd/system/manhwa-web.service >/dev/null << EOF
[Unit]
Description=Manhwa Recap Studio - Next.js Web App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$(which bun) run dev
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    # ── Pipeline Service ──
    sudo tee /etc/systemd/system/manhwa-pipeline.service >/dev/null << EOF
[Unit]
Description=Manhwa Recap Studio - Pipeline Service (Socket.IO)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR/mini-services/pipeline-service
ExecStart=$(which bun) run dev
Restart=always
RestartSec=5
Environment=PORT=$PORT_PIPELINE
EnvironmentFile=$PROJECT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    # ── Caddy Service (custom config) ──
    sudo tee /etc/systemd/system/manhwa-caddy.service >/dev/null << EOF
[Unit]
Description=Manhwa Recap Studio - Caddy Reverse Proxy
After=network.target manhwa-web.service

[Service]
Type=simple
ExecStart=$(which caddy) run --config $PROJECT_DIR/Caddyfile.prod
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Create production Caddyfile
    cat > Caddyfile.prod << 'EOF'
# Manhwa Recap Studio v3 — Production Caddy Config
# Listens on port 80 (change to your domain for auto-HTTPS)

:{env:PORT_CADDY:80} {
	# Pipeline service WebSocket proxy
	@pipeline {
		path /socket.io/*
	}
	handle @pipeline {
		reverse_proxy localhost:3001 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}

	# Internal API proxy (pipeline → backend)
	@internal_api {
		path /internal/*
	}
	handle @internal_api {
		reverse_proxy localhost:3001 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}

	# Everything else → Next.js
	handle {
		reverse_proxy localhost:3000 {
			header_up Host {host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
			header_up X-Real-IP {remote_host}
		}
	}
}
EOF

    # Reload systemd and enable services
    sudo systemctl daemon-reload
    sudo systemctl enable manhwa-web manhwa-pipeline 2>/dev/null
    sudo systemctl enable manhwa-caddy 2>/dev/null || log_warn "Could not enable Caddy service (may need manual setup)"
    log_info "Systemd services installed and enabled"
else
    log_warn "systemd not available — services will run in tmux sessions"
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 9: Oracle Cloud Firewall
# ═══════════════════════════════════════════════════════════════════
log_step 9 "Configuring firewall..."

if command -v iptables &>/dev/null; then
    # Allow SSH (already open on Oracle Cloud, but be explicit)
    sudo iptables -C INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    # Allow HTTP
    sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
    # Allow HTTPS
    sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
    # Allow Next.js dev port (direct access if Caddy is down)
    sudo iptables -C INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
    log_info "Firewall rules configured (ports 22, 80, 443, 3000)"
    log_warn "⚠ IMPORTANT: Also open port 80 in your Oracle Cloud Console →
  ⚠   Instance → Networking → Security Lists → Ingress Rules"
else
    log_warn "iptables not found — skip firewall config"
fi

# ═══════════════════════════════════════════════════════════════════
# STEP 10: Start Everything
# ═══════════════════════════════════════════════════════════════════
log_step 10 "Starting all services..."

# Stop any existing instances
if command -v systemctl &>/dev/null; then
    sudo systemctl stop manhwa-web manhwa-pipeline manhwa-caddy 2>/dev/null || true
    sudo systemctl start manhwa-web
    sleep 2
    sudo systemctl start manhwa-pipeline
    sleep 2
    sudo systemctl start manhwa-caddy 2>/dev/null || true
    log_info "Services started via systemd"
else
    # Fallback: use tmux sessions
    tmux kill-session -t manhwa-web 2>/dev/null || true
    tmux kill-session -t manhwa-pipeline 2>/dev/null || true

    tmux new-session -d -s manhwa-web "cd $PROJECT_DIR && bun run dev 2>&1 | tee logs/web.log"
    sleep 2
    tmux new-session -d -s manhwa-pipeline "cd $PROJECT_DIR/mini-services/pipeline-service && bun run dev 2>&1 | tee logs/pipeline.log"
    log_info "Services started in tmux sessions (attach: tmux attach -t manhwa-web)"
fi

# Wait for services to come up
echo -n "  Waiting for services to start"
for i in $(seq 1 30); do
    if curl -sf http://localhost:$PORT_WEB/ >/dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Verify
echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}                SETUP COMPLETE ✓                          ${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Services:${NC}"
echo -e "    Web App (Next.js):     ${GREEN}http://<your-ip>:$PORT_CADDY${NC}"
echo -e "    Direct (no proxy):     http://<your-ip>:$PORT_WEB"
echo -e "    Pipeline Service:      localhost:$PORT_PIPELINE (internal)"
echo -e "    Ollama API:            localhost:11434"
echo ""
echo -e "  ${BOLD}Local LLMs (Ollama):${NC}"
echo -e "    Vision (transcription): ${GREEN}$OLLAMA_VISION_MODEL${NC}"
echo -e "    Text (narration):       ${GREEN}$OLLAMA_TEXT_MODEL${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    View logs:              ${CYAN}journalctl -u manhwa-web -f${NC}"
echo -e "    Restart web:           ${CYAN}sudo systemctl restart manhwa-web${NC}"
echo -e "    Restart pipeline:       ${CYAN}sudo systemctl restart manhwa-pipeline${NC}"
echo -e "    Ollama status:          ${CYAN}ollama list${NC}"
echo -e "    Pull another model:    ${CYAN}ollama pull llama3.1:8b${NC}"
echo ""
echo -e "  ${BOLD}Optional API keys (add to .env for faster transcription):${NC}"
echo -e "    GROQ_API_KEY=           ${YELLOW}(free at console.groq.com)${NC}"
echo -e "    GEMINI_API_KEY=         ${YELLOW}(free at aistudio.google.com)${NC}"
echo -e "    OPENROUTER_API_KEY=     ${YELLOW}(free tier at openrouter.ai)${NC}"
echo ""
echo -e "  ${BOLD}⚠ Oracle Cloud:${NC} Don't forget to open port 80 in the"
echo "    OCI Console → Networking → Security Lists → Add Ingress Rule"
echo -e "    Source: 0.0.0.0/0  Destination Port: 80  Protocol: TCP"
echo ""
log_info "Setup complete! 🚀"
