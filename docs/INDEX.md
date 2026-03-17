# Documentation Index

## Overview

This is the complete documentation set for the Enterprise VPN Gateway & PKI Management Platform.

---

## Documentation Structure

```
docs/
├── product/                          # Product Documentation
│   ├── README.md                     # Product Overview
│   ├── FEATURE_LIST.md              # Complete Feature List
│   ├── PRODUCT_DEVELOPMENT.md       # Development Guide
│   ├── ARCHITECTURE.md              # System Architecture
│   └── CHANGELOG.md                 # Version History
│
├── api/                              # API Documentation
│   └── README.md                     # Complete API Reference
│
├── guides/                           # Configuration Guides
│   ├── INSTALLATION.md               # Installation Guide
│   ├── PKI_SETUP.md                  # PKI Configuration Guide
│   ├── VPN_SETUP.md                  # VPN Configuration Guide
│   └── SITE_TO_SITE_SETUP.md         # Site-to-Site VPN Guide
│
├── developer/                        # Developer Documentation
│   ├── DATABASE_SCHEMA.md            # Database Documentation
│   └── MINI_SERVICES.md              # Background Services
│
└── STRONGSWAN_DOCS.md               # strongSwan Reference
```

---

## Quick Reference

### For New Users
1. Start with **Product Overview** (`product/README.md`)
2. Follow **Installation Guide** (`guides/INSTALLATION.md`)
3. Configure PKI using **PKI Setup Guide** (`guides/PKI_SETUP.md`)
4. Set up VPN using **VPN Setup Guide** (`guides/VPN_SETUP.md`)

### For Developers
1. Read **Product Development** (`product/PRODUCT_DEVELOPMENT.md`)
2. Study **System Architecture** (`product/ARCHITECTURE.md`)
3. Reference **Database Schema** (`developer/DATABASE_SCHEMA.md`)
4. Understand **Mini-Services** (`developer/MINI_SERVICES.md`)

### For API Integration
- Complete **API Reference** (`api/README.md`)

### For Site-to-Site VPN
- Follow **Site-to-Site Setup Guide** (`guides/SITE_TO_SITE_SETUP.md`)

---

## Document Descriptions

### Product Documentation

| Document | Description |
|----------|-------------|
| README.md | Product overview, capabilities, and quick start |
| FEATURE_LIST.md | Complete list of all features with status |
| PRODUCT_DEVELOPMENT.md | Development guide, code structure, API patterns |
| ARCHITECTURE.md | System architecture, data flow, security |
| CHANGELOG.md | Version history and roadmap |

### API Documentation

| Document | Description |
|----------|-------------|
| README.md | Complete REST API reference with examples |

### Configuration Guides

| Document | Description |
|----------|-------------|
| INSTALLATION.md | System requirements, installation steps, troubleshooting |
| PKI_SETUP.md | PKI mode selection, CA management, certificate lifecycle |
| VPN_SETUP.md | Connection profiles, IP pools, tunnel templates |
| SITE_TO_SITE_SETUP.md | Remote gateways, network tunnels, monitoring |

### Developer Documentation

| Document | Description |
|----------|-------------|
| DATABASE_SCHEMA.md | All models, relationships, indexes |
| MINI_SERVICES.md | Background services (OCSP, CRL, Renewal) |
| DEVELOPMENT_GUIDE.md | Coding standards, API patterns, best practices |
| TROUBLESHOOTING.md | Bug fixing, debugging, error codes |

### Product Planning

| Document | Description |
|----------|-------------|
| ROADMAP.md | Feature roadmap, planned enhancements |
| CHANGELOG.md | Version history and release notes |

---

## Key Topics Covered

### PKI Management
- Managed PKI vs External CA modes
- Root and Intermediate CA creation
- Certificate generation and signing
- Certificate revocation (CRL, OCSP)
- Certificate renewal

### VPN Configuration
- IKEv2/IPsec setup
- Multiple authentication modes
- Connection profiles
- IP address pools
- Tunnel templates (split/full tunnel)
- Site-to-Site VPN

### Security
- JWT authentication
- Two-factor authentication
- Role-based access control
- CSRF protection
- Rate limiting
- Audit logging

### Network Management
- Firewall rules (nftables)
- NAT policies
- Network interfaces
- Static routing
- Diagnostics

### System Administration
- User management
- Backup and restore
- API key management
- System monitoring
- Alerting

---

## Support

For technical support, bug reports, or feature requests, please refer to the project repository or contact the development team.

---

## Version

**Documentation Version:** 1.0.0
**Last Updated:** 2024
**Platform Version:** 1.0.0

---

*This documentation is provided as part of the Enterprise VPN Gateway & PKI Management Platform.*
