# 24online SecureGate
## Enterprise VPN PKI Management Platform

---

# Product Overview

**24online SecureGate** is a comprehensive, enterprise-grade VPN PKI (Public Key Infrastructure) management platform designed for seamless certificate lifecycle management, VPN configuration, and network security administration. Built for service providers, enterprises, and managed security teams, SecureGate simplifies complex PKI operations while maintaining enterprise-level security and compliance.

---

# Key Capabilities

## 1. Certificate Lifecycle Management

### Complete PKI Control
- **Managed PKI Mode** - Full self-hosted Certificate Authority with complete control over certificate issuance, renewal, and revocation
- **External CA Integration** - Support for customer-provided CA certificates for organizations with existing PKI infrastructure
- **Hybrid Deployment** - Switch between managed and external CA modes based on organizational requirements

### Certificate Operations
| Feature | Description |
|---------|-------------|
| Client Certificates | Issue, manage, and revoke client certificates for VPN authentication |
| Server Certificates | Generate and deploy VPN server certificates with SAN support |
| PKCS#12 Export | Password-protected .pfx/.p12 files for easy client distribution |
| PEM Export | Standard certificate and private key exports |
| Email Distribution | Send certificates directly to users via integrated SMTP |
| Certificate Renewal | Streamlined renewal process with validity period customization |
| Key Size Options | 2048-bit and 4096-bit RSA key support |

### CSR Management
- Generate Certificate Signing Requests (CSR) for server and client certificates
- Upload externally signed certificates
- Complete CSR lifecycle management with download capabilities

---

## 2. Certificate Revocation & CRL Management

### Revocation Services
- **Real-time Revocation** - Instant certificate revocation with automatic CRL update
- **Multiple Revocation Reasons** - Standard revocation reason codes (Key Compromise, CA Compromise, Affiliation Changed, etc.)
- **CRL Auto-Generation** - Automatic Certificate Revocation List updates
- **strongSwan Integration** - One-click CRL deployment to VPN servers
- **OCSP Support** - Online Certificate Status Protocol configuration for real-time status checking

---

## 3. VPN Configuration & Management

### Connection Profiles
- **IKEv1 & IKEv2 Support** - Modern and legacy VPN protocol support
- **Custom IKE/ESP Proposals** - Fine-tuned encryption and integrity algorithms
- **Multi-Authentication Modes**:
  - Managed Certificates (Full PKI)
  - External CA Certificates
  - External CA + RADIUS (WiFi+VPN unified auth)
  - EAP-RADIUS Authentication
  - EAP-TLS Authentication
- **IP Pool Management** - Dynamic IP address assignment for VPN clients
- **DNS Configuration** - Custom DNS server assignment
- **Tunnel Templates** - Split tunnel and full tunnel route templates
- **Config Preview** - Preview generated configurations before deployment

### Site-to-Site VPN
- Remote gateway management
- Network-to-network tunnel configuration
- Secure inter-office connectivity

### Identity & Authentication
- **Identity Mappings** - Certificate field extraction for username identification
- **RADIUS Integration** - External authentication server support
- **LDAP/Active Directory Sync** - Automatic user synchronization with corporate directories

### VPN Monitoring
- **Active Sessions View** - Real-time connected user monitoring
- **Session Termination** - Administrative control over active connections
- **Service Management** - Reload and restart VPN services

---

## 4. User Management

### VPN Users
- Complete user lifecycle management
- Department and organizational grouping
- Certificate status tracking per user
- Bulk import/export (CSV, Excel)
- User enable/disable functionality

### Administrator Accounts
- **Role-Based Access Control (RBAC)**:
  - Super Admin - Full system access
  - Admin - Administrative operations
  - Operator - Day-to-day operations
  - Viewer - Read-only access
- Two-Factor Authentication status tracking
- Protected system accounts
- Password reset capabilities

### Guest Access
- Temporary user management
- Time-limited access controls

---

## 5. Network Management

### Interface Configuration
- **Multi-Interface Support** - WAN, LAN, VPN, Management interfaces
- **Flexible IP Configuration**:
  - DHCP (Automatic)
  - Static IP
  - PPPoE (ISP connections)
- **Traffic Monitoring** - Real-time RX/TX statistics
- **MTU Configuration** - Optimized packet sizes
- **DNS Management** - Per-interface DNS settings

### Routing
- Static route management
- Gateway configuration
- Network path optimization

### Network Diagnostics
- Built-in troubleshooting tools
- Network connectivity testing

---

## 6. Security & Firewall

### Firewall Rules (nftables)
- **Packet Filtering** - Allow/Deny rules with priority management
- **Protocol Support** - TCP, UDP, ICMP, ALL
- **Flexible Matching** - Source/destination IP and port filtering
- **Interface Binding** - Per-interface rule application
- **Real-time Statistics** - Packet and byte counters per rule
- **Rule Ordering** - Drag-and-drop priority management

### NAT Policies
- **SNAT** - Source Network Address Translation
- **DNAT** - Destination Network Address Translation
- **Masquerade** - Dynamic NAT for dynamic IP connections

### Access Control
- Access policy management
- Traffic segmentation

### Geographic Restrictions
- Country-based access control
- IP-based filtering

---

## 7. Monitoring & Analytics

### Dashboard
- **At-a-Glance Metrics** - Users, certificates, connections, system health
- **Real-time Traffic Charts** - Network bandwidth visualization
- **Certificate Status Overview** - Active, expired, revoked, expiring soon
- **Geographic Connection Map** - Visual representation of connection origins
- **Activity Heatmap** - Usage pattern visualization

### System Health
- CPU utilization monitoring
- Memory usage tracking
- Disk space monitoring
- System uptime display

### Audit & Compliance
- **Comprehensive Audit Logs** - All system activities recorded
- **Category-based Filtering** - Authentication, certificate ops, PKI management, etc.
- **CSV Export** - Compliance reporting support
- **Log Retention Policies** - Configurable log retention
- **Session Reports** - VPN connection analytics

---

## 8. Integration & Automation

### API Access
- RESTful API for automation
- API key management with permissions
- Configurable key expiration
- Enable/disable API access per key

### Authentication Integrations
- **RADIUS** - External authentication servers
- **LDAP/Active Directory** - User directory synchronization
- Automatic user provisioning

### Email Integration
- SMTP configuration
- Certificate distribution via email
- Test email functionality

### SIEM Integration
- Security event forwarding
- Log aggregation support

---

## 9. Backup & Disaster Recovery

### Backup Options
- **Full Backup** - Complete system state
- **Database Backup** - Data-only backup
- **Configuration Backup** - Settings and profiles

### Recovery Features
- One-click restore
- Backup download for off-site storage
- Backup history and management

---

## 10. Platform Features

### User Interface
- **Modern Web Interface** - Responsive design for all devices
- **Dark/Light Theme** - User preference support
- **Command Palette** - Quick navigation (Ctrl+K)
- **Real-time Updates** - Live data without page refresh
- **Intuitive Navigation** - Collapsible sidebar with clear organization

### Security Features
- Secure session management
- Role-based access control
- Protected administrative accounts
- Audit trail for all operations

### Deployment
- Web-based management console
- strongSwan VPN integration
- OpenVPN support
- Standards-based PKI (X.509)

---

# Technical Specifications

## Supported Protocols
| Protocol | Description |
|----------|-------------|
| IKEv1 | Legacy IPsec VPN |
| IKEv2 | Modern IPsec VPN |
| OpenVPN | SSL-based VPN |
| X.509 | PKI certificate standard |
| OCSP | Online certificate status |
| CRL | Certificate revocation lists |

## Cryptographic Support
| Feature | Options |
|---------|---------|
| Key Sizes | 2048-bit, 4096-bit RSA |
| Hash Algorithms | SHA-256, SHA-384, SHA-512 |
| Cipher Suites | AES-256, AES-256-GCM |
| DH Groups | MODP-1024, MODP-2048, MODP-3072 |

## Integration Support
| Integration | Status |
|-------------|--------|
| strongSwan | Full Integration |
| OpenVPN | Supported |
| RADIUS | Full Support |
| LDAP/AD | Full Support |
| SMTP | Full Support |
| REST API | Full Support |

---

# Use Cases

## For Internet Service Providers (ISPs)
- Manage VPN services for multiple business customers
- White-label ready platform
- Scalable certificate management
- Multi-tenant capabilities

## For Enterprises
- Secure remote workforce access
- Certificate-based authentication
- Compliance-ready audit trails
- Integration with existing infrastructure

## For Managed Security Service Providers (MSSPs)
- Centralized VPN management
- Customer isolation and management
- Comprehensive reporting
- API-based automation

---

# Competitive Advantages

| Feature | Benefit |
|---------|---------|
| **Dual PKI Mode** | Flexibility to use managed or external CA based on requirements |
| **Complete Lifecycle** | End-to-end certificate management from creation to revocation |
| **Multi-Auth Support** | Support for various authentication methods in one platform |
| **Real-time Monitoring** | Live dashboard with actionable insights |
| **Enterprise Security** | RBAC, audit logs, and compliance features built-in |
| **Easy Integration** | Connects with existing RADIUS, LDAP, and email systems |
| **Modern UI** | Intuitive interface reduces training time and errors |
| **API First** | Full REST API for automation and integration |

---

# Compliance & Security Standards

- **X.509 PKI Standard** - Industry-standard certificate format
- **RFC 5280** - Certificate and CRL profile compliance
- **Strong Cryptography** - AES-256, SHA-256+ support
- **Audit Logging** - Complete activity tracking for compliance
- **Role-Based Access** - Principle of least privilege enforcement

---

# Support & Documentation

- Comprehensive online documentation
- API reference guides
- Installation and configuration guides
- Best practices documentation

---

# Contact Information

**Product**: 24online SecureGate  
**Category**: VPN PKI Management Platform  
**Deployment**: On-premises / Private Cloud  

---

*Document Version: 1.0*  
*Last Updated: January 2025*

---

# Appendix: Feature Summary Table

| Category | Feature Count |
|----------|---------------|
| Dashboard & Monitoring | 16 |
| Certificate Management | 25 |
| PKI Operations | 20 |
| VPN Configuration | 30 |
| User Management | 15 |
| Network Management | 12 |
| Security & Firewall | 15 |
| Audit & Reporting | 10 |
| Settings & Integration | 20 |
| Platform Features | 10 |
| **Total Features** | **150+** |

---

**© 2025 24online. All Rights Reserved.**
