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
# ║  Supports: Oracle Linux, Ubuntu, Debian, RHEL, Amazon Linux     ║
# ╚══════════════════════════════════════════════════════════════════╝
#
set -uo pipefail
# NOTE: We intentionally do NOT use `set -e` because some package
# installs legitimately fail on certain OSes and we handle them.

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

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
PYTHON_VENV="$PROJECT_DIR/.venv"
PYTHON_BIN="$PYTHON_VENV/bin/python3"

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
is_deb=false
is_rhel=false

if command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
    is_deb=true
    pkg_update()  { sudo apt-get update -qq 2>&1 | tail -1; }
    pkg_install() { sudo apt-get install -y -qq "$@" 2>&1 | tail -1 || log_warn "Some packages failed to install"; }
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    is_rhel=true
    pkg_update()  { sudo dnf update -q 2>&1 | tail -1 || true; }
    pkg_install() { sudo dnf install -y -q "$@" 2>&1 | tail -1 || log_warn "Some packages failed to install"; }
elif command -v yum &>/dev/null; then
    PKG_MGR="yum"
    is_rhel=true
    pkg_update()  { sudo yum update -q 2>&1 | tail -1 || true; }
    pkg_install() { sudo yum install -y -q "$@" 2>&1 | tail -1 || log_warn "Some packages failed to install"; }
else
    log_error "No supported package manager found (apt/dnf/yum)"
    exit 1
fi

log_info "Package manager: $PKG_MGR (${OS})"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 0: Swap File (Oracle Cloud ARM can get tight with Ollama models)
# ═══════════════════════════════════════════════════════════════════════════════
log_step 0 "Checking swap space..."

CURRENT_SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
if [[ "$CURRENT_SWAP_KB" -lt 2097152 ]]; then
    # Less than 2GB swap — create a 4GB swap file
    SWAPFILE="/swapfile"
    if [[ ! -f "$SWAPFILE" ]]; then
        log_info "Creating 4GB swap file (current: $((CURRENT_SWAP_KB / 1024))MB)"
        sudo fallocate -l 4G "$SWAPFILE" 2>/dev/null || sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=4096 status=progress 2>/dev/null
        sudo chmod 600 "$SWAPFILE"
        sudo mkswap "$SWAPFILE" >/dev/null
        sudo swapon "$SWAPFILE" 2>/dev/null && log_info "4GB swap activated" || log_warn "Could not activate swap (may need root)"
        # Persist across reboot
        if ! grep -q "$SWAPFILE" /etc/fstab 2>/dev/null; then
            echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
            log_info "Swap entry added to /etc/fstab"
        fi
    else
        log_info "Swap file already exists ($((CURRENT_SWAP_KB / 1024))MB)"
    fi
else
    log_info "Swap space adequate ($((CURRENT_SWAP_KB / 1024))MB)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: System Packages
# ═══════════════════════════════════════════════════════════════════════════════
log_step 1 "Installing system packages..."

pkg_update

if $is_deb; then
    # ── Debian/Ubuntu packages ──
    pkg_install curl wget git unzip build-essential \
        ffmpeg python3 python3-pip python3-venv python3-dev \
        libgl1 libglib2.0-0 libcap2-bin \
        ca-certificates gnupg lsb-release jq sqlite3 tmux htop
else
    # ── RHEL/Oracle Linux/Amazon Linux packages ──
    # Enable EPEL for additional packages
    sudo dnf install -y epel-release 2>/dev/null || \
        sudo amazon-linux-extras install epel -y 2>/dev/null || true

    pkg_install curl wget git unzip gcc gcc-c++ make \
        ffmpeg python3 python3-pip python3-devel \
        mesa-libGL glib2 libcap \
        ca-certificates gnupg2 redhat-lsb-core jq sqlite tmux htop

    # python3-venv equivalent: ensure venv module is available
    if ! python3 -m venv --help &>/dev/null; then
        pkg_install python3-virtualenv 2>/dev/null || true
    fi
fi

log_info "System packages installed"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Bun Runtime
# ═══════════════════════════════════════════════════════════════════════════════
log_step 2 "Installing Bun runtime..."

BUN_PATH="$HOME/.bun/bin/bun"
if [[ -x "$BUN_PATH" ]]; then
    log_info "Bun already installed: $($BUN_PATH --version)"
else
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    BUN_PATH="$BUN_INSTALL/bin/bun"
    log_info "Bun installed: $($BUN_PATH --version)"
fi

# Ensure bun is in PATH for the rest of this script
export PATH="$HOME/.bun/bin:$PATH"

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
if ! pgrep -f 'ollama' &>/dev/null; then
    if command -v systemctl &>/dev/null; then
        sudo systemctl start ollama 2>/dev/null || {
            ollama serve >/dev/null 2>&1 &
            sleep 5
        }
    else
        ollama serve >/dev/null 2>&1 &
        sleep 5
    fi
    # Wait for Ollama to be ready
    for i in $(seq 1 10); do
        ollama list &>/dev/null && break
        sleep 2
    done
    log_info "Ollama service started"
else
    log_info "Ollama service already running"
fi

# Pull vision model (for panel text transcription)
log_info "Pulling vision model: $OLLAMA_VISION_MODEL (this may take a few minutes on first run)..."
if ollama list 2>/dev/null | grep -qF "${OLLAMA_VISION_MODEL%%:*}"; then
    log_info "Vision model '$OLLAMA_VISION_MODEL' already pulled"
else
    ollama pull "$OLLAMA_VISION_MODEL" && \
        log_info "Vision model '$OLLAMA_VISION_MODEL' ready" || \
        log_warn "Failed to pull vision model — run later: ollama pull $OLLAMA_VISION_MODEL"
fi

# Pull text model (for narrative rewriting)
log_info "Pulling text model: $OLLAMA_TEXT_MODEL..."
if ollama list 2>/dev/null | grep -qF "${OLLAMA_TEXT_MODEL%%:*}"; then
    log_info "Text model '$OLLAMA_TEXT_MODEL' already pulled"
else
    ollama pull "$OLLAMA_TEXT_MODEL" && \
        log_info "Text model '$OLLAMA_TEXT_MODEL' ready" || \
        log_warn "Failed to pull text model — run later: ollama pull $OLLAMA_TEXT_MODEL"
fi

log_info "Ollama models ready:"
ollama list 2>/dev/null | tail -n +2 | while read -r line; do
    log_info "  $line"
done

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Python Virtual Environment + ML Dependencies
# ═══════════════════════════════════════════════════════════════════════════════
log_step 4 "Setting up Python venv + ML dependencies..."

if [[ -d "$PYTHON_VENV" ]]; then
    log_info "Python venv already exists at $PYTHON_VENV"
else
    python3 -m venv "$PYTHON_VENV"
    log_info "Created Python venv at $PYTHON_VENV"
fi

# Activate venv for this shell session
source "$PYTHON_VENV/bin/activate"

log_info "Installing Python dependencies from pipeline/requirements.txt..."
pip install --upgrade pip setuptools wheel -q 2>&1 | tail -1
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
print('  All Python deps OK')
" || log_warn "Some Python imports failed — check the output above"

log_info "Python venv: $PYTHON_BIN"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Node.js / Bun Dependencies
# ═══════════════════════════════════════════════════════════════════════════════
log_step 5 "Installing Node.js/Bun dependencies..."

log_info "Installing main project dependencies..."
bun install 2>&1 | tail -3

log_info "Installing pipeline-service dependencies..."
(cd mini-services/pipeline-service && bun install 2>&1 | tail -3)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Database Setup (Prisma + SQLite) + .env
# ═══════════════════════════════════════════════════════════════════════════════
log_step 6 "Setting up database (Prisma + SQLite)..."

mkdir -p db

# Create .env if not exists
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        log_info "Created .env from .env.example"
    else
        cat > .env << ENVEOF
# Manhwa Recap Studio v3 — Environment Configuration
DATABASE_URL=file:./db/custom.db

# Python (venv)
PYTHON_BIN=${PYTHON_BIN}
PROJECT_ROOT=${PROJECT_DIR}
DATA_DIR=${PROJECT_DIR}/data

# Ollama (local LLMs — free, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL}
OLLAMA_TEXT_MODEL=${OLLAMA_TEXT_MODEL}

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

# Ensure critical paths are in .env (even if user already had a .env)
for VAR_NAME in PYTHON_BIN PROJECT_ROOT DATA_DIR OLLAMA_BASE_URL OLLAMA_VISION_MODEL OLLAMA_TEXT_MODEL; do
    if ! grep -q "^${VAR_NAME}=" .env 2>/dev/null; then
        case $VAR_NAME in
            PYTHON_BIN)      VAL="$PYTHON_BIN" ;;
            PROJECT_ROOT)    VAL="$PROJECT_DIR" ;;
            DATA_DIR)        VAL="$PROJECT_DIR/data" ;;
            OLLAMA_BASE_URL) VAL="http://localhost:11434" ;;
            OLLAMA_VISION_MODEL) VAL="$OLLAMA_VISION_MODEL" ;;
            OLLAMA_TEXT_MODEL)   VAL="$OLLAMA_TEXT_MODEL" ;;
        esac
        echo "${VAR_NAME}=${VAL}" >> .env
        log_info "Added ${VAR_NAME} to .env"
    fi
done

# Push Prisma schema
bunx prisma db push --accept-data-loss 2>&1 | tail -3
log_info "Database ready"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Caddy Reverse Proxy
# ═══════════════════════════════════════════════════════════════════════════════
log_step 7 "Setting up Caddy reverse proxy..."

if command -v caddy &>/dev/null; then
    log_info "Caddy already installed: $(caddy version 2>/dev/null | head -1)"
else
    log_info "Installing Caddy..."
    if $is_deb; then
        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https 2>/dev/null || true
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
            sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
            sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
        sudo apt-get update -qq 2>/dev/null
        sudo apt-get install -y caddy 2>/dev/null || log_warn "Caddy install failed (non-critical)"
    else
        sudo dnf install -y 'dnf-command(copr)' 2>/dev/null || true
        sudo dnf copr enable @caddy/caddy -y 2>/dev/null || true
        sudo dnf install -y caddy 2>/dev/null || log_warn "Caddy install failed (non-critical)"
    fi
fi

if command -v caddy &>/dev/null; then
    log_info "Caddy installed: $(caddy version 2>/dev/null | head -1)"
    CADDY_BIN=$(which caddy)
else
    CADDY_BIN=""
    log_warn "Caddy not installed — web traffic will use port 3000 directly"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Systemd Services (auto-start on boot)
# ═══════════════════════════════════════════════════════════════════════════════
log_step 8 "Installing systemd services..."

if command -v systemctl &>/dev/null; then
    # Resolve absolute paths at write-time (heredocs expand variables immediately)
    ABS_BUN="$BUN_PATH"
    ABS_PYTHON="$PYTHON_BIN"
    ABS_CADDY="${CADDY_BIN:-$(which caddy 2>/dev/null)}"

    # ── Next.js App Service ──
    sudo tee /etc/systemd/system/manhwa-web.service >/dev/null << EOF
[Unit]
Description=Manhwa Recap Studio - Next.js Web App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$ABS_BUN run dev
Restart=always
RestartSec=5
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
ExecStart=$ABS_BUN run dev
Restart=always
RestartSec=5
Environment=PORT=$PORT_PIPELINE
EnvironmentFile=$PROJECT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    # ── Caddy Service (only if Caddy was installed) ──
    if [[ -n "$ABS_CADDY" && -x "$ABS_CADDY" ]]; then
        sudo tee /etc/systemd/system/manhwa-caddy.service >/dev/null << EOF
[Unit]
Description=Manhwa Recap Studio - Caddy Reverse Proxy
After=network.target manhwa-web.service

[Service]
Type=simple
User=root
ExecStart=$ABS_CADDY run --config $PROJECT_DIR/Caddyfile.prod
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        CADDY_ENABLED=true
    else
        CADDY_ENABLED=false
    fi

    # Create production Caddyfile (plain :80, no env var syntax)
    cat > Caddyfile.prod << 'CPFEEOF'
# Manhwa Recap Studio v3 — Production Caddy Config
# Change :80 to your domain (e.g. recap.example.com) for auto-HTTPS

:80 {
	@pipeline {
		path /socket.io/*
	}
	handle @pipeline {
		reverse_proxy localhost:3001
	}

	@internal_api {
		path /internal/*
	}
	handle @internal_api {
		reverse_proxy localhost:3001
	}

	handle {
		reverse_proxy localhost:3000
	}
}
CPFEOF

    # Reload systemd and enable services
    sudo systemctl daemon-reload
    sudo systemctl enable manhwa-web manhwa-pipeline 2>/dev/null
    if $CADDY_ENABLED; then
        sudo systemctl enable manhwa-caddy 2>/dev/null || log_warn "Could not enable Caddy service"
    fi
    log_info "Systemd services installed and enabled"
else
    log_warn "systemd not available — services will run in tmux sessions"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: Oracle Cloud Firewall (defense-in-depth)
# ═══════════════════════════════════════════════════════════════════════════════
log_step 9 "Configuring firewall..."

if command -v iptables &>/dev/null; then
    for port in 22 80 443 3000; do
        sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
            sudo iptables -A INPUT -p tcp --dport "$port" -j ACCEPT
    done
    log_info "Firewall rules configured (ports 22, 80, 443, 3000)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10: Start Everything
# ═══════════════════════════════════════════════════════════════════════════════
log_step 10 "Starting all services..."

mkdir -p logs data

if command -v systemctl &>/dev/null; then
    sudo systemctl stop manhwa-web manhwa-pipeline manhwa-caddy 2>/dev/null || true
    sudo systemctl start manhwa-web
    sleep 3
    sudo systemctl start manhwa-pipeline
    sleep 2
    if $CADDY_ENABLED; then
        sudo systemctl start manhwa-caddy 2>/dev/null || true
    fi
    log_info "Services started via systemd"
else
    # Fallback: use tmux sessions
    tmux kill-session -t manhwa-web 2>/dev/null || true
    tmux kill-session -t manhwa-pipeline 2>/dev/null || true

    tmux new-session -d -s manhwa-web   "cd $PROJECT_DIR && $BUN_PATH run dev 2>&1 | tee logs/web.log"
    sleep 3
    tmux new-session -d -s manhwa-pipeline "cd $PROJECT_DIR/mini-services/pipeline-service && $BUN_PATH run dev 2>&1 | tee logs/pipeline.log"
    log_info "Services started in tmux sessions (attach: tmux attach -t manhwa-web)"
fi

# Wait for services to come up
echo -n "  Waiting for web server"
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT_WEB/" >/dev/null 2>&1; then
        echo " OK"
        break
    fi
    echo -n "."
    sleep 2
done

# Verify pipeline
if curl -sf "http://localhost:$PORT_PIPELINE/internal/health" >/dev/null 2>&1; then
    log_info "Pipeline service healthy"
else
    log_warn "Pipeline service not responding yet (may need a moment)"
fi

# ── Final Summary ──────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}═════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}${BOLD}                SETUP COMPLETE                            ${NC}"
echo -e "${CYAN}${BOLD}═════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Services:${NC}"
echo -e "    Web App:              ${GREEN}http://<your-ip>:80${NC} (via Caddy)"
echo -e "    Direct access:        http://<your-ip>:$PORT_WEB"
echo -e "    Pipeline (internal):  localhost:$PORT_PIPELINE"
echo -e "    Ollama API:           localhost:11434"
echo ""
echo -e "  ${BOLD}Local LLMs (Ollama):${NC}"
echo -e "    Vision (transcription): ${GREEN}$OLLAMA_VISION_MODEL${NC}"
echo -e "    Text (narration):       ${GREEN}$OLLAMA_TEXT_MODEL${NC}"
echo ""
echo -e "  ${BOLD}Python:${NC}"
echo -e "    Venv:                 ${CYAN}${PYTHON_VENV}${NC}"
echo -e "    Binary:               ${CYAN}${PYTHON_BIN}${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    View web logs:        ${CYAN}journalctl -u manhwa-web -f${NC}"
echo -e "    View pipeline logs:   ${CYAN}journalctl -u manhwa-pipeline -f${NC}"
echo -e "    Restart web:         ${CYAN}sudo systemctl restart manhwa-web${NC}"
echo -e "    Restart pipeline:     ${CYAN}sudo systemctl restart manhwa-pipeline${NC}"
echo -e "    Ollama status:        ${CYAN}ollama list${NC}"
echo -e "    Pull another model:  ${CYAN}ollama pull llama3.1:8b${NC}"
echo ""
echo -e "  ${BOLD}Optional (add to .env for faster transcription):${NC}"
echo -e "    GROQ_API_KEY=           ${YELLOW}(free — console.groq.com/keys)${NC}"
echo -e "    GEMINI_API_KEY=         ${YELLOW}(free — aistudio.google.com/apikey)${NC}"
echo -e "    OPENROUTER_API_KEY=     ${YELLOW}(free tier — openrouter.ai/keys)${NC}"
echo ""
echo -e "  ${BOLD}${RED}Oracle Cloud — IMPORTANT:${NC}"
echo "    Open port 80 in OCI Console:"
echo "    Networking → Security Lists → Add Ingress Rule"
echo "    Source: 0.0.0.0/0  Port: 80  Protocol: TCP"
echo ""
log_info "Setup complete!"