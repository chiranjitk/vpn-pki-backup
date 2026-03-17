# Changelog

All notable changes to the VPN PKI Management Platform are documented in this file.

---

## [1.0.0] - 2024

### Added

#### Core Platform
- Initial release of VPN PKI Management Platform
- Next.js 16 with App Router architecture
- SQLite database with Prisma ORM
- JWT-based authentication with role-based access control
- Responsive web interface with shadcn/ui components

#### PKI Management
- **Managed PKI Mode**
  - Root CA creation and management
  - Intermediate CA creation
  - Automatic certificate signing
  - CRL generation and management
  - OCSP responder service

- **External CA Mode**
  - Import external CA certificates
  - CRL auto-fetch from external URLs
  - CSR generation for external signing
  - Certificate upload from external CAs

- **Certificate Operations**
  - Client certificate generation
  - Server certificate generation
  - PKCS#12 bundle export
  - Certificate revocation
  - Certificate renewal (manual and automatic)

#### VPN Management
- **Connection Profiles**
  - Multiple authentication modes (Managed Cert, External Cert, RADIUS, EAP)
  - IKEv1/IKEv2 support
  - Custom IKE/ESP proposals
  - IP pool management
  - DNS configuration
  - DPD settings

- **Site-to-Site VPN**
  - Remote gateway management
  - PSK authentication
  - Certificate authentication
  - Network-to-network tunnel configuration
  - Tunnel monitoring (latency, throughput, status)
  - DPD configuration

- **Tunnel Templates**
  - Split tunnel templates
  - Full tunnel templates
  - Custom route configurations
  - DNS push settings

#### User Management
- **Administrative Users**
  - Role-based access (SUPER_ADMIN, ADMIN, OPERATOR, VIEWER)
  - Two-factor authentication (TOTP)
  - Account protection for system accounts
  - Login history tracking

- **VPN Users**
  - User CRUD operations
  - Certificate assignment
  - Department organization
  - Status management

- **Guest Users**
  - Time-limited access
  - Approval workflow
  - Sponsor assignment
  - Auto-expiration

#### Security Features
- **Authentication Security**
  - JWT token authentication
  - CSRF protection
  - Rate limiting
  - Session management
  - Password hashing (bcrypt)

- **Access Control**
  - Geo/IP restrictions
  - Country-based blocking
  - IP range rules
  - ASN-based filtering

#### Network Management
- **Firewall**
  - nftables-based packet filtering
  - Rule management
  - NAT policies
  - Port forwarding

- **Network Configuration**
  - Interface management
  - Static routing
  - Network diagnostics (ping, traceroute, DNS lookup)

#### Monitoring & Analytics
- **Real-time Monitoring**
  - VPN session tracking
  - Tunnel status monitoring
  - Service health checks
  - Certificate status

- **Historical Metrics**
  - RRD-style data retention
  - Raw metrics (5-minute intervals, 7 days)
  - Hourly aggregation (30 days)
  - Daily aggregation (1+ years)

- **Alerting**
  - Certificate expiry warnings
  - Service down alerts
  - System health alerts
  - Email notifications

#### System Administration
- **Backup & Recovery**
  - Full system backup
  - Configuration backup
  - Certificate backup
  - One-click restore

- **Audit Logging**
  - Comprehensive operation logging
  - Category-based filtering
  - Actor attribution
  - IP address tracking

- **API Management**
  - API key generation
  - Permission scoping
  - Usage tracking
  - Key expiration

#### Integration
- **Authentication Servers**
  - RADIUS integration
  - LDAP/AD integration
  - Connection testing

- **SIEM Integration**
  - Splunk support
  - ELK Stack support
  - QRadar support
  - Syslog output
  - Webhook integration

#### Background Services
- **OCSP Responder** (Port 3033)
  - Real-time certificate status
  - OCSP request handling
  - Response signing

- **CRL Scheduler** (Port 3031)
  - Auto-fetch from external CAs
  - Retry logic
  - Format conversion (DER/PEM)

- **Certificate Renewal Service** (Port 3032)
  - Expiry monitoring
  - Auto-renewal
  - Email notifications

### Security
- Minimum 4096-bit RSA keys
- SHA-256 minimum signature algorithm
- Secure password storage with bcrypt
- HTTPS enforcement
- Session timeout protection
- Rate limiting on sensitive endpoints

### Documentation
- Product overview documentation
- Complete feature list
- API documentation
- Installation guide
- PKI configuration guide
- VPN setup guide
- Site-to-Site VPN guide
- Database schema documentation
- Mini-services documentation

---

## Upcoming Features (Roadmap)

### Phase 3 - Advanced Features
- High availability / clustering support
- Multi-tenancy support
- Advanced traffic shaping
- Full IPv6 support
- Mobile device management integration

### Phase 4 - Enterprise Features
- Cloud deployment templates (AWS, Azure, GCP)
- Kubernetes/Container support
- AI-powered anomaly detection
- Custom branding / white-label options
- Advanced reporting dashboard
- SAML SSO integration
- OAuth 2.0 / OpenID Connect support

---

## Version Naming Convention

- **Major (X.0.0)**: Breaking changes, major features
- **Minor (1.X.0)**: New features, backwards compatible
- **Patch (1.0.X)**: Bug fixes, minor improvements

---

## Upgrade Notes

### From Development to 1.0.0

Initial release - no upgrade path required.

---

*Last Updated: 2024*
