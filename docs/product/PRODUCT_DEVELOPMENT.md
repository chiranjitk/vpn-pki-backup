# Product Development Document

## Development Overview

This document provides comprehensive information for developers working on or extending the Enterprise VPN Gateway & PKI Management Platform.

---

## 1. Project Structure

### 1.1 Directory Layout

```
vpn-pki-platform/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             # Authentication endpoints
│   │   │   ├── vpn/              # VPN management APIs
│   │   │   ├── certificates/     # Certificate APIs
│   │   │   ├── firewall/         # Firewall APIs
│   │   │   ├── users/            # User management APIs
│   │   │   └── ...               # Other API modules
│   │   ├── vpn/                  # VPN pages
│   │   ├── users/                # User pages
│   │   ├── settings/             # Settings pages
│   │   └── page.tsx              # Dashboard (home)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # App layout components
│   │   ├── vpn/                  # VPN feature components
│   │   ├── pki/                  # PKI components
│   │   ├── firewall/             # Firewall components
│   │   └── ...                   # Other feature components
│   ├── lib/
│   │   ├── db.ts                 # Prisma client
│   │   ├── utils.ts              # Utility functions
│   │   ├── middleware/           # Rate limiting, CSRF
│   │   ├── pki/                  # PKI operations
│   │   ├── vpn/                  # VPN operations
│   │   ├── firewall/             # Firewall operations
│   │   └── email/                # Email services
│   └── hooks/
│       ├── use-auth.ts           # Authentication hook
│       └── use-csrf.ts           # CSRF protection hook
├── prisma/
│   └── schema.prisma             # Database schema
├── db/
│   └── custom.db                 # SQLite database
├── mini-services/
│   ├── ocsp-responder/           # OCSP service (port 3033)
│   ├── cert-renewal/             # Renewal service (port 3032)
│   └── crl-scheduler/            # CRL service (port 3031)
├── scripts/
│   └── create-admin.ts           # Admin creation script
└── docs/                         # Documentation
```

### 1.2 Key Files

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/pki/openssl.ts` | OpenSSL wrapper for certificate operations |
| `src/lib/pki/strongswan.ts` | strongSwan integration |
| `src/lib/vpn/profiles.ts` | Connection profile management |
| `src/lib/vpn/site-to-site.ts` | Site-to-site VPN management |
| `src/lib/firewall/nftables.ts` | nftables firewall integration |
| `src/lib/middleware/rate-limit.ts` | Rate limiting implementation |
| `src/lib/middleware/csrf.ts` | CSRF protection |
| `prisma/schema.prisma` | Database models and relations |

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  Dashboard  │ │    PKI      │ │    VPN      │   ...        │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js API Routes)               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  /api/auth  │ │/api/vpn/*   │ │/api/certs/* │   ...        │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Database     │ │  Background     │ │  System         │
│    (SQLite)     │ │  Services       │ │  Integration    │
│                 │ │                 │ │                 │
│  - Prisma ORM   │ │  - OCSP (3033)  │ │  - strongSwan   │
│  - Models       │ │  - Renewal      │ │  - nftables     │
│  - Relations    │ │  - CRL Fetch    │ │  - OpenSSL      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 Technology Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 16 | Server components, API routes, SSR |
| Database | SQLite + Prisma | Simple deployment, type-safe queries |
| UI Library | shadcn/ui | Accessible, customizable components |
| Styling | Tailwind CSS 4 | Utility-first, rapid development |
| VPN Engine | strongSwan 6.0.1 | Industry-standard IPsec implementation |
| PKI Tools | OpenSSL 3.x | Mature, well-documented certificate handling |
| Runtime | Bun/Node.js | Fast JavaScript runtime |

### 2.3 Data Flow

```
User Action → Component → API Route → Library Function → System Command/Database
                                │
                                └──→ Audit Log Entry
```

---

## 3. Database Schema

### 3.1 Core Models

```prisma
// User Management
model AdminUser { ... }      // Administrative users
model VpnUser { ... }        // VPN end users
model GuestUser { ... }      // Temporary access users

// PKI
model CertificateAuthority { ... }  // CA certificates
model Certificate { ... }           // Client/Server certificates
model ServerCertificate { ... }     // VPN server certificates
model Revocation { ... }            // Revoked certificates
model CrlInfo { ... }               // CRL metadata

// VPN
model ConnectionProfile { ... }     // VPN connection configs
model VpnSession { ... }            // Active/past sessions
model IpPool { ... }                // Address pools
model IpAllocation { ... }          // IP assignments
model TunnelTemplate { ... }        // Split/full tunnel configs
model AuthServer { ... }            // RADIUS/LDAP servers

// Site-to-Site
model RemoteGateway { ... }         // Peer gateways
model SiteToSiteTunnel { ... }      // Network tunnels
model TunnelMonitoring { ... }      // Tunnel metrics

// Security
model FirewallRule { ... }          // nftables rules
model GeoIpRestriction { ... }      // Access restrictions
model ApiKey { ... }                // API credentials

// System
model AuditLog { ... }              // Operation history
model Notification { ... }          // User notifications
model SystemSetting { ... }         // Configuration
model BackupRecord { ... }          // Backup metadata
model SmtpConfiguration { ... }     // Email settings
model SiemIntegration { ... }       // External logging

// Metrics
model MetricData { ... }            // Raw metrics (7 days)
model MetricDataHourly { ... }      // Hourly aggregates (30 days)
model MetricDataDaily { ... }       // Daily aggregates (1+ year)
```

### 3.2 Key Relationships

```
VpnUser 1──N Certificate 1──1 Revocation
CertificateAuthority 1──1 CrlInfo
ConnectionProfile N──1 TunnelTemplate
ConnectionProfile N──1 IdentityMapping
SiteToSiteTunnel N──1 RemoteGateway
SiteToSiteTunnel 1──N TunnelMonitoring
IpPool 1──N IpAllocation
```

---

## 4. API Development

### 4.1 API Route Structure

```typescript
// src/app/api/[resource]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List resources
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (id) {
    const item = await db.resource.findUnique({ where: { id } })
    return NextResponse.json({ item })
  }
  
  const items = await db.resource.findMany()
  return NextResponse.json({ items })
}

// POST - Create resource
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // Validation
  if (!body.name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  
  // Create
  const item = await db.resource.create({ data: body })
  
  // Audit log
  await db.auditLog.create({
    data: {
      action: 'CREATE_RESOURCE',
      category: 'RESOURCE_MANAGEMENT',
      targetId: item.id,
      targetType: 'Resource',
      actorType: 'ADMIN',
      status: 'SUCCESS'
    }
  })
  
  return NextResponse.json({ item }, { status: 201 })
}

// PUT - Update resource
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...data } = body
  
  const item = await db.resource.update({
    where: { id },
    data
  })
  
  return NextResponse.json({ item })
}

// DELETE - Remove resource
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  await db.resource.delete({ where: { id } })
  
  return NextResponse.json({ success: true })
}
```

### 4.2 API Response Format

**Success Response:**
```json
{
  "item": { ... },
  "items": [ ... ],
  "stats": { ... }
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": { ... }
}
```

### 4.3 Authentication

All API routes (except `/api/auth/*`) require authentication:

```typescript
// In API route
import { getServerSession } from 'next-auth'

const session = await getServerSession()
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## 5. Frontend Development

### 5.1 Component Structure

```typescript
// src/components/[feature]/[feature]-content.tsx

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface Item {
  id: string
  name: string
  // ...
}

export function FeatureContent() {
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchItems()
  }, [])
  
  const fetchItems = async () => {
    try {
      const res = await fetch('/api/feature')
      const data = await res.json()
      setItems(data.items || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch items',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* UI implementation */}
    </div>
  )
}
```

### 5.2 Page Structure

```typescript
// src/app/feature/page.tsx

import { AppLayout } from '@/components/layout/app-layout'
import { FeatureContent } from '@/components/feature/feature-content'

export default function FeaturePage() {
  return (
    <AppLayout>
      <FeatureContent />
    </AppLayout>
  )
}
```

### 5.3 State Management

- **Server State**: React Query or direct fetch
- **Client State**: Zustand for global state
- **Form State**: React Hook Form with Zod validation

---

## 6. Background Services

### 6.1 Mini-Service Structure

```typescript
// mini-services/[service]/index.ts

import { serve } from 'bun'

const PORT = 3031

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    
    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' })
    }
    
    // Status endpoint
    if (url.pathname === '/status') {
      return Response.json(getStatus())
    }
    
    // Handle other routes...
    
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
})

console.log(`Service running on port ${PORT}`)
```

### 6.2 Service Communication

Services communicate via HTTP with port transformation:

```typescript
// From main app to mini-service
const response = await fetch(`/api/service?XTransformPort=3031`, {
  method: 'POST',
  body: JSON.stringify(data)
})
```

---

## 7. Security Implementation

### 7.1 Authentication Flow

```
1. User submits credentials
2. Server validates against AdminUser table
3. Password verified with bcrypt
4. JWT token generated (expires in 24h)
5. Token stored in HTTP-only cookie
6. Subsequent requests include token
7. Token validated on each API call
```

### 7.2 CSRF Protection

```typescript
// Double-submit cookie pattern
const token = generateToken()
res.cookies.set('csrf-token', token, { httpOnly: true })

// On API call
const cookieToken = req.cookies.get('csrf-token')
const headerToken = req.headers.get('X-CSRF-Token')
if (cookieToken !== headerToken) {
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
}
```

### 7.3 Rate Limiting

```typescript
// src/lib/middleware/rate-limit.ts
const rateLimits = {
  login: { max: 5, window: 60 },       // 5 per minute
  certificates: { max: 10, window: 60 }, // 10 per minute
  default: { max: 100, window: 60 }     // 100 per minute
}
```

---

## 8. Testing

### 8.1 Running Tests

```bash
# Unit tests
bun test

# E2E tests
bun run test:e2e

# Coverage
bun run test:coverage
```

### 8.2 Test Structure

```typescript
// __tests__/api/certificates.test.ts

describe('Certificates API', () => {
  it('should list certificates', async () => {
    const res = await fetch('/api/certificates')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.certificates).toBeDefined()
  })
  
  it('should create certificate', async () => {
    const res = await fetch('/api/certificates', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test', commonName: 'test' })
    })
    expect(res.status).toBe(201)
  })
})
```

---

## 9. Deployment

### 9.1 Production Build

```bash
# Build
bun run build

# Start production
bun run start
```

### 9.2 Systemd Service

```ini
# /etc/systemd/system/vpn-pki.service
[Unit]
Description=VPN PKI Management Platform
After=network.target

[Service]
Type=simple
User=vpn-pki
Group=vpn-pki
WorkingDirectory=/opt/vpn-pki-platform
ExecStart=/usr/bin/bun run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 9.3 Reverse Proxy

```caddyfile
# Caddyfile
vpn.example.com {
    reverse_proxy localhost:3000
    tls internal
}
```

---

## 10. Troubleshooting

### 10.1 Common Issues

| Issue | Solution |
|-------|----------|
| Database locked | Ensure single process accessing SQLite |
| strongSwan commands fail | Check sudo permissions |
| Certificate generation fails | Verify OpenSSL installation |
| Session not persisting | Check cookie settings |

### 10.2 Debug Mode

```bash
# Enable debug logging
DEBUG=* bun run dev

# Check strongSwan logs
journalctl -u strongswan -f
```

---

## 11. Contributing

### 11.1 Code Style

- TypeScript strict mode
- ESLint + Prettier formatting
- Conventional commits

### 11.2 Pull Request Process

1. Create feature branch
2. Write tests for new features
3. Update documentation
4. Submit PR with description
5. Code review required
6. Squash merge to main

---

*Last Updated: 2024*
