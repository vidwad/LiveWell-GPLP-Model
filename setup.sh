#!/bin/bash
set -e

# ============================================================
# Living Well Communities — DigitalOcean Setup Script
# Run this on a fresh Ubuntu 22.04+ Droplet:
#   curl -sSL https://raw.githubusercontent.com/vidwad/LiveWell-GPLP-Model/master/setup.sh | bash
# ============================================================

echo ""
echo "=========================================="
echo "  Living Well Communities — Setup"
echo "=========================================="
echo ""

# ── 1. Install Docker if not present ──────────────────────────
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker installed."
fi

# ── 2. Install Docker Compose plugin if not present ───────────
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    sudo apt-get update -y
    sudo apt-get install -y docker-compose-plugin
fi

# ── 3. Clone the repo ────────────────────────────────────────
REPO_DIR="LiveWell-GPLP-Model"
if [ ! -f "docker-compose.yml" ]; then
    if [ ! -d "$REPO_DIR" ]; then
        echo "Cloning repository..."
        git clone https://github.com/vidwad/LiveWell-GPLP-Model.git
        cd "$REPO_DIR"
    else
        cd "$REPO_DIR"
        echo "Pulling latest changes..."
        git pull origin master
    fi
else
    # Already inside the repo directory
    echo "Already in the repository directory."
fi

# ── 4. Create .env if it doesn't exist ────────────────────────
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env

    # Auto-generate a secure JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/CHANGE_ME_run_openssl_rand_hex_32/$JWT_SECRET/" .env

    # Auto-generate a secure database password
    DB_PASS=$(openssl rand -hex 16)
    sed -i "s/CHANGE_ME_strong_password_here/$DB_PASS/" .env

    # Auto-detect the droplet's public IP
    DROPLET_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || curl -s https://ifconfig.me 2>/dev/null || echo "localhost")
    sed -i "s/YOUR_DROPLET_IP/$DROPLET_IP/g" .env

    # Ask for optional Anthropic API key (for AI Assistant)
    echo ""
    read -p "Anthropic API Key (press Enter to skip): " ANTHROPIC_KEY
    if [ -n "$ANTHROPIC_KEY" ]; then
        echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY" >> .env
    fi

    echo ""
    echo "  .env created with auto-generated secrets."
    echo "  Droplet IP detected: $DROPLET_IP"
    echo ""
fi

# ── 5. Open firewall ports ────────────────────────────────────
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    sudo ufw allow 22/tcp   # SSH
    sudo ufw allow 80/tcp   # HTTP
    sudo ufw allow 443/tcp  # HTTPS
    sudo ufw allow 3000/tcp # Frontend
    sudo ufw allow 8000/tcp # Backend API
    sudo ufw --force enable
fi

# ── 6. Build and start everything ─────────────────────────────
echo ""
echo "Building and starting all services..."
echo "This may take 3-5 minutes on first run."
echo ""
docker compose up -d --build

# ── 7. Wait for services to be healthy ────────────────────────
echo ""
echo "Waiting for services to start..."
sleep 30

# Check backend health
HEALTH=$(curl -s http://localhost:8000/healthz 2>/dev/null || echo "not ready")
if echo "$HEALTH" | grep -q "ok"; then
    echo "  Backend: OK"
else
    echo "  Backend: Starting up (may take another minute)..."
    echo "  Run 'docker compose logs -f backend' to check progress."
fi

# Check frontend
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$FRONTEND" = "200" ] || [ "$FRONTEND" = "307" ]; then
    echo "  Frontend: OK"
else
    echo "  Frontend: Starting up (may take another minute)..."
    echo "  Run 'docker compose logs -f frontend' to check progress."
fi

# ── 8. Print access info ──────────────────────────────────────
DROPLET_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || curl -s https://ifconfig.me 2>/dev/null || echo "YOUR_IP")

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "  Frontend:  http://$DROPLET_IP:3000"
echo "  Backend:   http://$DROPLET_IP:8000"
echo "  API Docs:  http://$DROPLET_IP:8000/docs"
echo ""
echo "  Login Credentials:"
echo "    admin@livingwell.ca / Password1!"
echo "    ops@livingwell.ca / Password1!"
echo "    pm@livingwell.ca / Password1!"
echo "    investor1@example.com / Password1!"
echo ""
echo "  To view logs:     docker compose logs -f"
echo "  To stop:          docker compose down"
echo "  To restart:       docker compose up -d"
echo "  To update:        git pull && docker compose up -d --build"
echo ""
echo "  IMPORTANT: Change the default passwords"
echo "  after first login!"
echo ""
