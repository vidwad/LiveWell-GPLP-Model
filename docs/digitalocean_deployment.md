# Living Well Communities: DigitalOcean Deployment Guide

This guide explains how to deploy the entire Living Well Communities platform (Frontend, Backend, and PostgreSQL Database) to a single DigitalOcean Droplet using Docker Compose.

This approach provides a permanent, shared environment where your whole team can collaborate on the same data, for about $6/month.

## Prerequisites

1. A [DigitalOcean](https://www.digitalocean.com/) account.
2. A basic understanding of SSH (how to log into a server).

## Step 1: Create a Droplet

1. Log into DigitalOcean and click **Create -> Droplets**.
2. **Region:** Choose the region closest to you (e.g., Toronto or New York).
3. **Image:** Choose **Ubuntu 22.04 (LTS) x64**.
4. **Size:** Choose **Basic -> Regular -> $6/mo** (1GB RAM, 1 CPU, 25GB SSD). This is plenty for the current app.
5. **Authentication:** Choose **SSH Key** (recommended) or **Password**.
6. **Hostname:** Name it something recognizable like `livingwell-prod`.
7. Click **Create Droplet**.

## Step 2: Connect to the Droplet

Once the Droplet is created, copy its public IP address. Open your terminal (Mac/Linux) or PowerShell/PuTTY (Windows) and run:

```bash
ssh root@YOUR_DROPLET_IP
```
*(If you chose Password authentication, enter the password you created).*

## Step 3: Run the One-Command Setup

Once logged into the server, run this single command. It will install Docker, clone the repository, generate secure passwords, configure the firewall, and start all services:

```bash
curl -sSL https://raw.githubusercontent.com/vidwad/LiveWell-GPLP-Model/master/setup.sh | bash
```

**What this script does:**
1. Installs Docker and Docker Compose.
2. Clones the `LiveWell-GPLP-Model` repository.
3. Creates a `.env` file with auto-generated secure passwords and JWT secrets.
4. Opens ports 80, 443, 3000, and 8000 in the firewall.
5. Builds the Next.js frontend and FastAPI backend.
6. Starts the PostgreSQL database.
7. Automatically runs database migrations and seeds the initial demo data.

*Note: The first run takes 3-5 minutes because it has to build the Next.js production bundle.*

## Step 4: Access the Application

When the script finishes, it will print out your access URLs. You can immediately open your browser and go to:

- **Frontend App:** `http://YOUR_DROPLET_IP:3000`
- **Backend API:** `http://YOUR_DROPLET_IP:8000`
- **API Documentation:** `http://YOUR_DROPLET_IP:8000/docs`

### Default Login Credentials

The database is automatically seeded with these demo accounts:

| Role | Email | Password |
|------|-------|----------|
| GP Admin | `admin@livingwell.ca` | `Password1!` |
| Operations | `ops@livingwell.ca` | `Password1!` |
| Property Mgr | `pm@livingwell.ca` | `Password1!` |
| Investor | `investor1@example.com` | `Password1!` |

**Security Warning:** Because this is now on the public internet, you should log in as the Admin and change these passwords immediately, or remove the demo accounts and create real ones.

## Step 5: Ongoing Maintenance

If you make changes to the code locally and push them to GitHub, here is how you update the server:

```bash
# 1. SSH into the server
ssh root@YOUR_DROPLET_IP

# 2. Go to the app directory
cd LiveWell-GPLP-Model

# 3. Pull the latest code
git pull origin master

# 4. Rebuild and restart the containers in the background
docker compose up -d --build
```

### Viewing Logs
If something isn't working, you can view the logs:
```bash
cd LiveWell-GPLP-Model
docker compose logs -f
```

### Database Backups
The PostgreSQL data is stored in a Docker volume. To back it up:
```bash
docker exec -t livewell-gplp-model-db-1 pg_dumpall -c -U livingwell > dump_`date +%Y-%m-%d`.sql
```

## Optional: Adding a Custom Domain (SSL)

Right now, the app is accessed via an IP address and port numbers. If you want to use a real domain (e.g., `app.livingwell.ca`) with secure HTTPS:

1. Point your domain's A-Record to the Droplet's IP address in your DNS settings.
2. SSH into the server and edit the `Caddyfile`:
   ```bash
   nano ~/LiveWell-GPLP-Model/Caddyfile
   ```
   Replace `YOUR_DOMAIN.com` with your actual domain.
3. Edit the `docker-compose.yml` file:
   ```bash
   nano ~/LiveWell-GPLP-Model/docker-compose.yml
   ```
   Uncomment the `caddy` service section at the bottom.
4. Restart the stack:
   ```bash
   docker compose up -d
   ```
Caddy will automatically request a free SSL certificate from Let's Encrypt, and your app will be securely available at `https://yourdomain.com`.
