# Installation Guide

## System Requirements

### Hardware Requirements
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Storage | 10 GB | 50+ GB |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements
| Software | Version |
|----------|---------|
| Operating System | Debian 12/13, Ubuntu 22.04+ |
| Node.js | 20 LTS or Bun |
| strongSwan | 6.0.1 |
| OpenSSL | 3.x |
| SQLite | 3.x |

### Network Requirements
| Port | Protocol | Purpose |
|------|----------|---------|
| 500/UDP | IKE | IKE key exchange |
| 4500/UDP | NAT-T | NAT traversal |
| 3000/TCP | HTTP | Web interface |
| 3031-3033/TCP | HTTP | Background services |

---

## Installation Steps

### 1. Prepare the System

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget gnupg2 ca-certificates \
    lsb-release sqlite3 openssl strongswan \
    strongswan-pki libcharon-extra-plugins \
    libcharon-extauth-plugins libstrongswan-extra-plugins

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Or install Bun
curl -fsSL https://bun.sh/install | bash
```

### 2. Download and Install

```bash
# Create application directory
sudo mkdir -p /opt/vpn-pki-platform
cd /opt/vpn-pki-platform

# Clone or extract the application
# Option A: From Git
git clone <repository-url> .

# Option B: From archive
tar -xzf vpn-pki-platform.tar.gz -C /opt/vpn-pki-platform

# Set ownership
sudo chown -R root:root /opt/vpn-pki-platform
```

### 3. Install Dependencies

```bash
cd /opt/vpn-pki-platform

# Using npm
npm install

# Or using Bun
bun install
```

### 4. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Required Environment Variables:**
```env
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="file:../db/custom.db"

# Session
SESSION_SECRET="your-secret-key-change-this"

# PKI
PKI_MODE=MANAGED
SWANCTL_PATH=/etc/swanctl

# Admin
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=ChangeMe123!
```

### 5. Initialize Database

```bash
# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# (Optional) Seed initial data
bun run db:seed
```

### 6. Create Admin User

```bash
# Run the admin creation script
bun run scripts/create-admin.ts

# You will be prompted for:
# - Username
# - Email
# - Password
```

### 7. Configure strongSwan

```bash
# Create required directories
sudo mkdir -p /etc/swanctl/{x509ca,x509,private,x509crl,conf.d}

# Set permissions
sudo chmod 700 /etc/swanctl/private
sudo chmod 755 /etc/swanctl/x509ca /etc/swanctl/x509 /etc/swanctl/x509crl

# Enable strongSwan
sudo systemctl enable strongswan
```

### 8. Create Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/vpn-pki.service
```

**Service Configuration:**
```ini
[Unit]
Description=VPN PKI Management Platform
After=network.target strongswan.service
Wants=strongswan.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/vpn-pki-platform
ExecStart=/usr/bin/bun run start
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable vpn-pki
sudo systemctl start vpn-pki
```

### 9. Start Background Services

```bash
# Create service for OCSP Responder
sudo nano /etc/systemd/system/vpn-ocsp.service
```

```ini
[Unit]
Description=VPN OCSP Responder Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vpn-pki-platform/mini-services/ocsp-responder
ExecStart=/usr/bin/bun run dev
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Create service for CRL Scheduler
sudo nano /etc/systemd/system/vpn-crl.service
```

```ini
[Unit]
Description=VPN CRL Scheduler Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vpn-pki-platform/mini-services/crl-scheduler
ExecStart=/usr/bin/bun run dev
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Create service for Certificate Renewal
sudo nano /etc/systemd/system/vpn-renewal.service
```

```ini
[Unit]
Description=VPN Certificate Renewal Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vpn-pki-platform/mini-services/cert-renewal
ExecStart=/usr/bin/bun run dev
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start all services
sudo systemctl daemon-reload
sudo systemctl enable vpn-ocsp vpn-crl vpn-renewal
sudo systemctl start vpn-ocsp vpn-crl vpn-renewal
```

### 10. Configure Reverse Proxy (Optional)

**Using Caddy:**
```bash
# Install Caddy
sudo apt install -y caddy

# Configure
sudo nano /etc/caddy/Caddyfile
```

```
vpn.yourdomain.com {
    reverse_proxy localhost:3000
    tls internal
}
```

```bash
# Restart Caddy
sudo systemctl restart caddy
```

**Using Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name vpn.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vpn.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Post-Installation

### 1. Access Web Interface

Open your browser and navigate to:
```
https://vpn.yourdomain.com
```

### 2. Initial Login

Use the admin credentials created during installation.

### 3. Initial Configuration

1. **Configure PKI Mode**
   - Navigate to PKI → Configuration
   - Choose Managed PKI or External CA mode

2. **Create Certificate Authority**
   - Navigate to PKI → CA Management
   - Create Root CA and Intermediate CA

3. **Generate Server Certificate**
   - Navigate to Server Certificates
   - Create certificate for your VPN server

4. **Create Connection Profile**
   - Navigate to VPN → Connection Profiles
   - Configure IKEv2 connection settings

5. **Apply Configuration**
   - Click "Apply All" to deploy to strongSwan

---

## Troubleshooting

### Check Service Status
```bash
# Main application
sudo systemctl status vpn-pki

# Background services
sudo systemctl status vpn-ocsp vpn-crl vpn-renewal

# strongSwan
sudo systemctl status strongswan
```

### View Logs
```bash
# Application logs
sudo journalctl -u vpn-pki -f

# strongSwan logs
sudo journalctl -u strongswan -f

# Check dev log (if running in dev mode)
tail -f /opt/vpn-pki-platform/dev.log
```

### Database Issues
```bash
# Check database file
ls -la /opt/vpn-pki-platform/db/

# Regenerate Prisma client
cd /opt/vpn-pki-platform
bun run db:generate
```

### Permission Issues
```bash
# Fix strongSwan permissions
sudo chown -R root:root /etc/swanctl
sudo chmod 700 /etc/swanctl/private
```

---

## Upgrading

```bash
# Stop services
sudo systemctl stop vpn-pki vpn-ocsp vpn-crl vpn-renewal

# Backup database
cp /opt/vpn-pki-platform/db/custom.db /backup/custom.db

# Update code
cd /opt/vpn-pki-platform
git pull origin main

# Install dependencies
bun install

# Update database schema
bun run db:push

# Start services
sudo systemctl start vpn-pki vpn-ocsp vpn-crl vpn-renewal
```

---

## Uninstallation

```bash
# Stop and disable services
sudo systemctl stop vpn-pki vpn-ocsp vpn-crl vpn-renewal
sudo systemctl disable vpn-pki vpn-ocsp vpn-crl vpn-renewal

# Remove service files
sudo rm /etc/systemd/system/vpn-*.service
sudo systemctl daemon-reload

# Remove application
sudo rm -rf /opt/vpn-pki-platform

# (Optional) Remove strongSwan
sudo apt remove --purge strongswan*
```

---

*Last Updated: 2024*
