#!/bin/bash
set -e

# ============================================================
# Living Well Communities — DigitalOcean Setup Script
# Run this on a fresh Ubuntu 22.04+ Droplet:
#   curl -sSL https://raw.githubusercontent.com/vidwad/LiveWell-GPLP-Model/master/setup.sh | bash
# Or after cloning:
#   chmod +x setup.sh && ./setup.sh
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
    echo "Docker installed. You may need to log out and back in for group changes."
fi

# ── 2. Install Docker Compose plugin if not present ───────────
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    sudo apt-get update -y
    sudo apt-get install -y docker-compose-plugin
fi

# ── 3. Clone the repo if not already in it ────────────────────
REPO_DIR="LiveWell-GPLP-Model"
if [ ! -f "docker-compose.yml" ]; then
    if [ ! -d "$REPO_DIR" ]; then
        echo "Cloning repository..."
        git clone https://github.com/vidwad/LiveWell-GPLP-Model.git
    fi
    cd "$REPO_DIR"
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
sleep 15

# Check backend health
HEALTH=$(curl -s http://localhost:8000/healthz 2>/dev/null || echo "not ready")
if echo "$HEALTH" | grep -q "ok"; then
    echo "  Backend: OK"
else
    echo "  Backend: Starting up (may take another minute)..."
fi

# ── 8. Print access info ──────────────────────────────────────
DROPLET_IP=$(grep "NEXT_PUBLIC_API_URL" .env | head -1 | sed 's|.*://||' | sed 's|:.*||')

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
echo ""
echo "  To view logs:     docker compose logs -f"
echo "  To stop:          docker compose down"
echo "  To restart:       docker compose up -d"
echo "  To update:        git pull && docker compose up -d --build"
echo ""
echo "  IMPORTANT: Change the default passwords"
echo "  after first login!"
echo ""
