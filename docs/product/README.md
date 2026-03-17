# Enterprise VPN Gateway & PKI Management Platform

## Product Overview

A comprehensive, production-grade VPN and Public Key Infrastructure (PKI) management solution designed for enterprise deployments. This platform provides complete lifecycle management for VPN infrastructure built on strongSwan 6.0.1, with advanced certificate management, multi-factor authentication, and comprehensive monitoring capabilities.

---

## Key Capabilities

### 🔐 PKI Management
- **Dual Mode Operation**: Managed PKI (full certificate lifecycle) or External CA integration
- **Certificate Lifecycle**: Generation, renewal, revocation, and deployment
- **Multiple Certificate Types**: Root CA, Intermediate CA, Server, and Client certificates
- **CRL Management**: Automatic generation, scheduling, and deployment
- **OCSP Responder**: Real-time certificate status validation

### 🌐 VPN Management
- **IKEv2/IPsec**: Modern VPN protocol support with strongSwan 6.0.1
- **Multi-Authentication**: Certificate-based, RADIUS, LDAP, and hybrid authentication
- **Connection Profiles**: Flexible VPN configuration with multiple auth modes
- **Site-to-Site VPN**: Network-to-network tunnel management
- **Tunnel Templates**: Split-tunnel and full-tunnel configurations

### 🛡️ Security & Compliance
- **Role-Based Access Control**: SUPER_ADMIN, ADMIN, OPERATOR, VIEWER roles
- **Two-Factor Authentication**: TOTP-based MFA for administrators
- **Audit Logging**: Comprehensive operation tracking
- **Geo/IP Restrictions**: Country, IP, and ASN-based access control
- **Rate Limiting**: Protection against brute-force attacks

### 📊 Monitoring & Analytics
- **Real-time Monitoring**: VPN sessions, tunnel status, system health
- **Historical Metrics**: RRD-style data retention (raw, hourly, daily)
- **Dashboard Analytics**: Traffic patterns, user activity, certificate health
- **Alert System**: Proactive notifications for critical events

### 🔧 Network Management
- **Firewall Rules**: nftables-based packet filtering
- **NAT Policies**: Source and destination NAT configuration
- **Network Interfaces**: Configuration and monitoring
- **Static Routes**: Routing table management
- **Diagnostics**: Ping, traceroute, DNS lookup tools

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| UI Library | shadcn/ui, Tailwind CSS 4 |
| Database | SQLite (Prisma ORM) |
| VPN Engine | strongSwan 6.0.1 |
| Runtime | Node.js 20+ / Bun |
| PKI Tools | OpenSSL 3.x |

---

## Documentation Structure

```
docs/
├── product/
│   ├── README.md                    # This file - Product overview
│   ├── FEATURE_LIST.md              # Complete feature list
│   ├── PRODUCT_DEVELOPMENT.md       # Development guide
│   ├── ARCHITECTURE.md              # System architecture
│   └── CHANGELOG.md                 # Version history
├── api/
│   ├── README.md                    # API overview
│   ├── AUTHENTICATION.md            # Auth API reference
│   ├── CERTIFICATES.md              # Certificate API reference
│   ├── VPN.md                       # VPN API reference
│   ├── FIREWALL.md                  # Firewall API reference
│   ├── USERS.md                     # User management API
│   ├── SYSTEM.md                    # System API reference
│   └── SITE_TO_SITE.md              # Site-to-Site API reference
├── guides/
│   ├── INSTALLATION.md              # Installation guide
│   ├── CONFIGURATION.md             # Configuration guide
│   ├── PKI_SETUP.md                 # PKI setup guide
│   ├── VPN_SETUP.md                 # VPN configuration guide
│   ├── FIREWALL_SETUP.md            # Firewall configuration
│   ├── SITE_TO_SITE_SETUP.md        # Site-to-site VPN guide
│   ├── BACKUP_RESTORE.md            # Backup and recovery
│   └── TROUBLESHOOTING.md           # Common issues and solutions
└── developer/
    ├── CONTRIBUTING.md              # Contribution guidelines
    ├── DATABASE_SCHEMA.md           # Database documentation
    ├── MINI_SERVICES.md             # Background services
    └── TESTING.md                   # Testing guide
```

---

## Quick Start

### Prerequisites
- Debian 12/13 or Ubuntu 22.04+
- Node.js 20 LTS or Bun runtime
- strongSwan 6.0.1
- OpenSSL 3.x

### Installation

```bash
# Clone repository
git clone <repository-url> vpn-pki-platform
cd vpn-pki-platform

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Initialize database
bun run db:push

# Create admin user
bun run scripts/create-admin.ts

# Start development server
bun run dev

# Start production server
bun run start
```

### Initial Setup

1. **Access the Platform**: Navigate to `http://localhost:3000`
2. **Login**: Use the admin credentials created during setup
3. **Configure PKI**: Go to PKI section and choose managed or external CA mode
4. **Create Certificates**: Generate server and client certificates
5. **Configure VPN**: Set up connection profiles in VPN section
6. **Deploy**: Apply configurations to strongSwan

---

## Support & Licensing

For enterprise support, custom deployments, or licensing inquiries, please contact the development team.

---

## Version

**Current Version**: 1.0.0
**Last Updated**: 2024
**Platform Status**: Production Ready
