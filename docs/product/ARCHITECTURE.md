# System Architecture

## Overview

The Enterprise VPN Gateway & PKI Management Platform is built on a modern, scalable architecture designed for production deployments.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Web Browser  │  │ VPN Clients  │  │ Mobile Apps  │  │ API Clients  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GATEWAY                                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                         Caddy Reverse Proxy                         │     │
│  │                        (HTTPS Termination)                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     Next.js Application                             │     │
│  │                         (Port 3000)                                  │     │
│  │                                                                      │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │     │
│  │  │   Pages/     │ │  API Routes  │ │    Lib/      │ │  Hooks/    │ │     │
│  │  │  Components  │ │  (REST API)  │ │  (Business)  │ │  (State)   │ │     │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│    DATA LAYER      │     │  SERVICE LAYER    │     │  SYSTEM LAYER     │
│                    │     │                   │     │                   │
│  ┌──────────────┐ │     │  ┌──────────────┐ │     │  ┌──────────────┐ │
│  │   SQLite     │ │     │  │ CRL Scheduler│ │     │  │  strongSwan  │ │
│  │   (Prisma)   │ │     │  │  (Port 3031) │ │     │  │   (IPsec)    │ │
│  └──────────────┘ │     │  └──────────────┘ │     │  └──────────────┘ │
│                    │     │  ┌──────────────┐ │     │  ┌──────────────┐ │
│  ┌──────────────┐ │     │  │   Renewal    │ │     │  │   nftables   │ │
│  │  File Store  │ │     │  │  (Port 3032) │ │     │  │  (Firewall)  │ │
│  │  (Certs/Keys)│ │     │  └──────────────┘ │     │  └──────────────┘ │
│  └──────────────┘ │     │  ┌──────────────┐ │     │  ┌──────────────┐ │
│                    │     │  │     OCSP     │ │     │  │   OpenSSL    │ │
│                    │     │  │  (Port 3033) │ │     │  │    (PKI)     │ │
│                    │     │  └──────────────┘ │     │  └──────────────┘ │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

---

## Component Details

### Frontend Layer

**Technology:** Next.js 16 with React 19

**Components:**
| Component | Technology | Purpose |
|-----------|------------|---------|
| Pages | App Router | Route handling |
| Components | React + shadcn/ui | UI elements |
| State Management | Zustand | Global state |
| Data Fetching | Native fetch | API communication |
| Styling | Tailwind CSS 4 | Responsive design |

**Key Features:**
- Server-side rendering for performance
- Client-side interactivity
- Dark/light theme support
- Responsive design for all devices

### API Layer

**Technology:** Next.js API Routes

**Structure:**
```
/api/
├── auth/           # Authentication
├── certificates/   # Certificate management
├── vpn/            # VPN configuration
├── firewall/       # Firewall rules
├── users/          # User management
├── audit/          # Audit logs
└── ...             # Other modules
```

**Security:**
- JWT authentication
- CSRF protection
- Rate limiting
- Input validation

### Business Logic Layer

**Location:** `src/lib/`

**Modules:**
| Module | Purpose |
|--------|---------|
| `pki/openssl.ts` | Certificate operations |
| `pki/strongswan.ts` | VPN integration |
| `vpn/profiles.ts` | Connection profiles |
| `vpn/site-to-site.ts` | Site-to-site management |
| `firewall/nftables.ts` | Firewall operations |
| `middleware/rate-limit.ts` | Rate limiting |
| `middleware/csrf.ts` | CSRF protection |
| `email/service.ts` | Email delivery |

### Data Layer

**Database:** SQLite with Prisma ORM

**Schema Sections:**
- User Management
- PKI Management
- VPN Configuration
- Security & Access Control
- Metrics & Monitoring
- System Configuration

**File Storage:**
```
/etc/swanctl/
├── x509ca/         # CA certificates
├── x509/           # Server/Client certificates
├── private/        # Private keys
├── x509crl/        # CRL files
└── conf.d/         # Configuration files
```

### Service Layer

**Background Services:**

| Service | Port | Purpose |
|---------|------|---------|
| CRL Scheduler | 3031 | Auto-fetch CRLs |
| Cert Renewal | 3032 | Auto-renew certificates |
| OCSP Responder | 3033 | Certificate status |

**Communication:**
- HTTP-based API
- Port transformation via gateway
- Graceful degradation when unavailable

---

## Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│   API    │────►│  Verify  │────►│  JWT     │
│          │     │  Route   │     │  Token   │     │  Decode  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                         │
                                         ▼
                                 ┌──────────────┐
                                 │   Session    │
                                 │   Lookup     │
                                 └──────────────┘
                                         │
                                         ▼
                                 ┌──────────────┐
                                 │   Request    │
                                 │   Processed  │
                                 └──────────────┘
```

### Defense Layers

1. **Network Layer**
   - Firewall rules
   - Geo/IP restrictions
   - Port filtering

2. **Application Layer**
   - Input validation
   - CSRF protection
   - Rate limiting
   - Session management

3. **Data Layer**
   - Parameterized queries (Prisma)
   - Encrypted storage (passwords)
   - Access control

4. **Audit Layer**
   - Operation logging
   - Change tracking
   - Security alerts

---

## Data Flow

### Certificate Generation Flow

```
User Request
     │
     ▼
┌────────────────┐
│ API Endpoint   │
│ /api/certs     │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Validation     │
│ - Permissions  │
│ - Parameters   │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ OpenSSL        │
│ - Generate Key │
│ - Create CSR   │
│ - Sign Cert    │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ File Storage   │
│ - Cert file    │
│ - Key file     │
│ - PKCS#12      │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Database       │
│ - Serial       │
│ - Expiry       │
│ - User link    │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Audit Log      │
│ - Action       │
│ - Actor        │
│ - Timestamp    │
└────────────────┘
```

### VPN Connection Flow

```
VPN Client
     │
     │ IKEv2/IPsec
     ▼
┌────────────────┐
│ strongSwan     │
│ - Auth         │
│ - SA Negotiate │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Certificate    │
│ Validation     │
│ - Chain verify │
│ - CRL check    │
│ - OCSP check   │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Profile Match  │
│ - Auth mode    │
│ - IP pool      │
│ - DNS config   │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ Session Start  │
│ - IP assign    │
│ - Log start    │
│ - Metrics      │
└────────────────┘
```

---

## Scalability Considerations

### Current Limitations

- SQLite database (single file)
- Single server deployment
- No built-in clustering

### Scaling Options

**Vertical Scaling:**
- Increase CPU cores
- Add more RAM
- Faster storage

**Horizontal Scaling (Future):**
- PostgreSQL migration
- Redis for session storage
- Load balancer integration
- Container orchestration

---

## Deployment Architecture

### Single Server (Current)

```
┌────────────────────────────────────────┐
│              Single Server              │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │   Next.js   │  │   strongSwan    │  │
│  │  (Port 3000)│  │  (UDP 500/4500) │  │
│  └─────────────┘  └─────────────────┘  │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Services   │  │    SQLite       │  │
│  │  (3031-33)  │  │    Database     │  │
│  └─────────────┘  └─────────────────┘  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Caddy Reverse Proxy        │   │
│  │         (Port 443)               │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### High Availability (Future)

```
                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  Node 1    │  │  Node 2    │  │  Node 3    │
    │  (App+VPN) │  │  (App+VPN) │  │  (App+VPN) │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                  ┌─────────────┐
                  │ PostgreSQL  │
                  │   Primary   │
                  └──────┬──────┘
                         │
                  ┌──────┴──────┐
                  │   Replica   │
                  └─────────────┘
```

---

## Monitoring & Observability

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/api/system/health` | Application health |
| `localhost:3031/status` | CRL service health |
| `localhost:3032/status` | Renewal service health |
| `localhost:3033/health` | OCSP service health |

### Metrics Collection

**Collected Metrics:**
- VPN connections
- Certificate counts
- System resources
- API response times
- Error rates

**Retention:**
- Raw: 7 days
- Hourly: 30 days
- Daily: 1+ years

### Logging

**Log Types:**
- Application logs (journalctl)
- Audit logs (database)
- Access logs (Caddy)
- VPN logs (strongSwan)

---

## Disaster Recovery

### Backup Strategy

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full | Weekly | 4 weeks |
| Database | Daily | 7 days |
| Certificates | On change | 1 year |
| Configuration | On change | 1 year |

### Recovery Procedures

1. **Database Recovery**
   ```bash
   cp /backup/custom.db /opt/vpn-pki-platform/db/
   ```

2. **Certificate Recovery**
   ```bash
   tar -xzf /backup/certs.tar.gz -C /etc/swanctl/
   ```

3. **Configuration Recovery**
   - Restore database
   - Apply configuration
   - Reload services

---

*Last Updated: 2024*
