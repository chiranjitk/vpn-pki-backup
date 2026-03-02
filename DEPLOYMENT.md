# 24online VPN Server - Deployment Guide

## Complete Setup Guide for Debian 13

This guide will walk you through deploying the VPN PKI Management Platform on Debian 13 with strongSwan 6.0.1.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Preparation](#system-preparation)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [PKI Configuration](#pki-configuration)
6. [strongSwan Integration](#strongswan-integration)
7. [Reverse Proxy Setup (Nginx)](#reverse-proxy-setup-nginx)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Systemd Service](#systemd-service)
10. [Post-Installation](#post-installation)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements
- **CPU**: 2 cores minimum
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 20GB minimum

### Software Requirements
- Debian 13 (Bookworm)
- Node.js 20+ (or Bun)
- OpenSSL 3.x
- strongSwan 6.0.1
- SQLite or PostgreSQL

---

## System Preparation

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Packages

```bash
# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Or install Bun (alternative)
curl -fsSL https://bun.sh/install | bash

# Install OpenSSL (usually pre-installed)
sudo apt install -y openssl

# Install strongSwan 6.0.1
sudo apt install -y strongswan swanctl libcharon-extra-plugins

# Install additional tools
sudo apt install -y git curl wget build-essential
```

### 3. Create Application User

```bash
# Create system user for the application
sudo useradd -r -s /bin/bash -d /var/lib/vpn-pki vpnadmin

# Add to strongswan group for certificate access
sudo usermod -a -G strongswan vpnadmin
```

### 4. Create Directory Structure

```bash
# PKI directories (outside web root for security)
sudo mkdir -p /var/lib/vpn-pki/{ca,certs,keys,crl,temp}
sudo mkdir -p /var/log/vpn-pki
sudo mkdir -p /opt/vpn-pki

# Set permissions
sudo chown -R vpnadmin:vpnadmin /var/lib/vpn-pki
sudo chown -R vpnadmin:vpnadmin /var/log/vpn-pki
sudo chown -R vpnadmin:vpnadmin /opt/vpn-pki

# Secure CA key directory
sudo chmod 700 /var/lib/vpn-pki/ca
sudo chmod 700 /var/lib/vpn-pki/keys
```

---

## Database Setup

### Option A: SQLite (Default, Simpler)

```bash
# SQLite is already included with Prisma
# Database file will be created at: /var/lib/vpn-pki/database.db
```

### Option B: PostgreSQL (Recommended for Production)

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE vpn_pki;
CREATE USER vpnadmin WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE vpn_pki TO vpnadmin;
\q
EOF

# Enable PostgreSQL service
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

---

## Application Deployment

### 1. Clone or Copy Application

```bash
# Copy the built application to /opt/vpn-pki
sudo -u vpnadmin cp -r /path/to/vpn-pki-app/* /opt/vpn-pki/

# Or clone from repository
sudo -u vpnadmin git clone https://github.com/yourorg/vpn-pki.git /opt/vpn-pki
```

### 2. Install Dependencies

```bash
cd /opt/vpn-pki

# Using npm
npm install --production

# Or using Bun
bun install --production
```

### 3. Configure Environment Variables

```bash
sudo -u vpnadmin tee /opt/vpn-pki/.env << 'EOF'
# Database Configuration
DATABASE_URL="file:/var/lib/vpn-pki/database.db"
# For PostgreSQL: DATABASE_URL="postgresql://vpnadmin:your_secure_password@localhost:5432/vpn_pki"

# Application Settings
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# PKI Configuration
PKI_BASE_DIR=/var/lib/vpn-pki
PKI_CA_DIR=/var/lib/vpn-pki/ca
PKI_CERTS_DIR=/var/lib/vpn-pki/certs
PKI_KEYS_DIR=/var/lib/vpn-pki/keys
PKI_CRL_DIR=/var/lib/vpn-pki/crl

# JWT Secret (generate a secure one)
JWT_SECRET="$(openssl rand -hex 64)"

# strongSwan Integration
STRONGSWAN_SSH_ENABLE=false
SWANCTL_CONFIG_PATH=/etc/swanctl
AUTO_RELOAD_STRONGSWAN=true

# Optional: External CA Mode
# EXTERNAL_CA_MODE=true
# EXTERNAL_CA_CERT_PATH=/path/to/ca.pem
# EXTERNAL_CA_KEY_PATH=/path/to/ca.key
EOF

# Generate secure JWT secret
sudo -u vpnadmin sed -i "s/\$(openssl rand -hex 64)/$(openssl rand -hex 64)/g" /opt/vpn-pki/.env

# Secure the environment file
sudo chmod 600 /opt/vpn-pki/.env
```

### 4. Build and Initialize

```bash
cd /opt/vpn-pki

# Build the application
npm run build
# Or: bun run build

# Push database schema
npm run db:push
# Or: bun run db:push

# Create initial admin user
npm run create-admin
```

---

## PKI Configuration

### Mode A: External CA Integration

If you have an existing CA:

```bash
# Copy your CA certificates
sudo cp /path/to/your/root-ca.pem /var/lib/vpn-pki/ca/external-root.pem
sudo cp /path/to/your/intermediate-ca.pem /var/lib/vpn-pki/ca/external-intermediate.pem

# Set permissions
sudo chown vpnadmin:vpnadmin /var/lib/vpn-pki/ca/*.pem
sudo chmod 644 /var/lib/vpn-pki/ca/*.pem

# Configure in .env
echo "PKI_MODE=EXTERNAL" >> /opt/vpn-pki/.env
echo "EXTERNAL_CA_CERT_PATH=/var/lib/vpn-pki/ca/external-intermediate.pem" >> /opt/vpn-pki/.env
```

### Mode B: Managed PKI (Recommended)

Initialize the internal CA through the web UI:

1. Navigate to **PKI Management**
2. Click **Initialize CA**
3. Enter CA details:
   - Name: `24online VPN Root CA`
   - Organization: `24online`
   - Country: `US`
   - Key Size: `4096`
   - Validity: `10 years` (3650 days)

Or via API:

```bash
curl -X POST http://localhost:3000/api/pki \
  -H "Content-Type: application/json" \
  -d '{
    "action": "init_ca",
    "name": "24online VPN Root CA",
    "organization": "24online",
    "country": "US",
    "keySize": 4096,
    "validityDays": 3650
  }'
```

---

## strongSwan Integration

### 1. Configure strongSwan Directories

```bash
# Ensure strongSwan directories exist
sudo mkdir -p /etc/swanctl/{x509ca,x509,private,x509crl,conf.d}

# Set permissions
sudo chmod 700 /etc/swanctl/private
```

### 2. Generate Server Certificate

Through the web UI:
1. Navigate to **PKI Management** > **Server Certificates**
2. Click **Generate Server Certificate**
3. Enter:
   - Common Name: `vpn.yourdomain.com`
   - DNS Names: `vpn.yourdomain.com, vpn2.yourdomain.com`
   - Key Size: `4096`
   - Validity: `2 years`

### 3. Configure swanctl.conf

```bash
sudo tee /etc/swanctl/swanctl.conf << 'EOF'
# VPN Server Configuration
# Generated by 24online VPN PKI Management Platform

connections {
  ikev2-eap-tls {
    version = 2
    mobike = yes
    reauth_time = 0
    fragmentation = yes
    
    local_addrs = 0.0.0.0
    
    local {
      auth = eap-tls
      certs = server-cert.pem
      id = @vpn.yourdomain.com
    }
    
    remote {
      auth = eap-tls
      eap_id = %any
    }
    
    children {
      ikev2-eap-tls {
        local_ts = 0.0.0.0/0
        remote_ts = dynamic
        
        esp_proposals = aes256gcm16-sha256-x25519
        mode = tunnel
        dpd_action = restart
        
        policies = yes
      }
    }
    
    pools = vpn-pool
  }
}

pools {
  vpn-pool {
    addrs = 10.10.0.0/24
    dns = 8.8.8.8, 8.8.4.4
  }
}

authorities {
  ca-authority {
    certs = ca.pem
    crl_uris = file:///etc/swanctl/x509crl/ca.crl.pem
  }
}

secrets {
  private-server {
    file = /etc/swanctl/private/server-key.pem
  }
}
EOF
```

### 4. Deploy Certificates to strongSwan

Through the web UI:
1. Navigate to **PKI Management**
2. Click **Deploy to strongSwan**

Or via API:

```bash
curl -X POST http://localhost:3000/api/pki \
  -H "Content-Type: application/json" \
  -d '{"action": "deploy_to_strongswan"}'
```

### 5. Configure strongSwan

```bash
# Edit strongswan.conf
sudo tee /etc/strongswan.conf << 'EOF'
charon {
  load_modular = yes
  plugins {
    include strongswan.d/charon/*.conf
  }
  
  # CRL checking
  crl_check = strict
  cache_crl = yes
  
  # File logging
  filelog {
    /var/log/charon.log {
      time_format = %b %e %T
      default = 2
      append = no
      flush_line = yes
    }
  }
}
EOF
```

### 6. Enable and Start strongSwan

```bash
sudo systemctl enable strongswan-starter
sudo systemctl start strongswan-starter
sudo systemctl status strongswan-starter
```

---

## Reverse Proxy Setup (Nginx)

### 1. Install Nginx

```bash
sudo apt install -y nginx
```

### 2. Create Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/vpn-pki << 'EOF'
server {
    listen 80;
    server_name vpn-admin.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vpn-admin.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/vpn-admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn-admin.yourdomain.com/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy to Next.js
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache static_cache;
        proxy_cache_valid 200 60d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/vpn-pki /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t
```

### 3. Enable Nginx

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d vpn-admin.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Using Self-Signed Certificate (Development)

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout /etc/ssl/private/vpn-admin.key \
  -out /etc/ssl/certs/vpn-admin.crt \
  -subj "/CN=vpn-admin.yourdomain.com/O=24online/C=US"
```

---

## Systemd Service

### Create Service File

```bash
sudo tee /etc/systemd/system/vpn-pki.service << 'EOF'
[Unit]
Description=24online VPN PKI Management Platform
After=network.target

[Service]
Type=simple
User=vpnadmin
Group=vpnadmin
WorkingDirectory=/opt/vpn-pki
Environment="NODE_ENV=production"
EnvironmentFile=/opt/vpn-pki/.env
ExecStart=/usr/bin/node /opt/vpn-pki/node_modules/.bin/next start
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/vpn-pki /var/log/vpn-pki

# Limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable vpn-pki
sudo systemctl start vpn-pki
sudo systemctl status vpn-pki
```

---

## Post-Installation

### 1. Verify Installation

```bash
# Check application status
sudo systemctl status vpn-pki

# Check strongSwan status
sudo swanctl --list-sas

# Check logs
tail -f /var/log/vpn-pki/app.log
tail -f /var/log/charon.log
```

### 2. Create Initial Admin User

```bash
# Access the web UI at https://vpn-admin.yourdomain.com
# Default credentials (change immediately):
# Username: admin
# Password: (check console output or logs)
```

### 3. Configure Firewall

```bash
# Allow VPN traffic
sudo ufw allow 500/udp
sudo ufw allow 4500/udp
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp

# Enable firewall
sudo ufw enable
```

### 4. Setup Log Rotation

```bash
sudo tee /etc/logrotate.d/vpn-pki << 'EOF'
/var/log/vpn-pki/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 vpnadmin vpnadmin
    sharedscripts
    postrotate
        systemctl reload vpn-pki > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
journalctl -u vpn-pki -f

# Check file permissions
ls -la /opt/vpn-pki/
ls -la /var/lib/vpn-pki/

# Verify environment
cat /opt/vpn-pki/.env
```

### Certificate Generation Fails

```bash
# Verify OpenSSL is working
openssl version

# Check CA files exist
ls -la /var/lib/vpn-pki/ca/

# Check permissions
sudo -u vpnadmin ls -la /var/lib/vpn-pki/ca/
```

### strongSwan Not Starting

```bash
# Check configuration
sudo swanctl --load-all

# Check logs
sudo journalctl -u strongswan-starter -f

# Verify certificates
sudo swanctl --list-certs
```

### CRL Not Working

```bash
# Generate new CRL
curl -X POST http://localhost:3000/api/pki \
  -H "Content-Type: application/json" \
  -d '{"action": "regenerate_crl"}'

# Deploy to strongSwan
curl -X POST http://localhost:3000/api/pki \
  -H "Content-Type: application/json" \
  -d '{"action": "deploy_to_strongswan"}'

# Reload strongSwan
sudo systemctl reload strongswan-starter
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users` | GET, POST, PUT, DELETE | VPN user management |
| `/api/certificates` | GET, POST | Certificate management |
| `/api/certificates/[id]` | GET, DELETE | Certificate download/revoke |
| `/api/pki` | GET, POST | PKI configuration |
| `/api/vpn` | GET, POST | VPN status and control |
| `/api/audit` | GET, POST | Audit logs |
| `/api/dashboard` | GET | Dashboard statistics |

---

## Support

For issues and support:
- Check logs in `/var/log/vpn-pki/`
- Review strongSwan logs: `/var/log/charon.log`
- Submit issues at: https://github.com/yourorg/vpn-pki/issues

---

*Generated for 24online VPN Server Management Platform*
