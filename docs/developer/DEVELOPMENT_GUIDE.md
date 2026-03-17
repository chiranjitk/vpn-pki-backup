# Development Guide - VPN PKI Management Platform

## Table of Contents
1. [Development Environment Setup](#1-development-environment-setup)
2. [Project Architecture](#2-project-architecture)
3. [Coding Standards](#3-coding-standards)
4. [API Development](#4-api-development)
5. [Frontend Development](#5-frontend-development)
6. [Database Operations](#6-database-operations)
7. [Mini-Services Development](#7-mini-services-development)
8. [Testing & Quality Assurance](#8-testing--quality-assurance)
9. [Deployment Guidelines](#9-deployment-guidelines)
10. [Security Best Practices](#10-security-best-practices)

---

## 1. Development Environment Setup

### Prerequisites
- **Node.js**: v20 LTS or higher
- **Bun**: Latest version (recommended package manager)
- **PostgreSQL/SQLite**: For database
- **OpenSSL**: v3.x for PKI operations
- **strongSwan**: v6.0.1 (for production testing)

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd vpn-pki-platform

# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
bun run db:push
bun run db:generate

# Create admin user
bun run scripts/create-admin.ts

# Start development server
bun run dev
```

### Environment Variables
```env
# Database
DATABASE_URL="file:../db/custom.db"

# Authentication
JWT_SECRET="your-secure-jwt-secret"
JWT_EXPIRY="24h"

# PKI Paths
SWANCTL_PATH="/etc/swanctl"
PKI_KEYS_PATH="/etc/swanctl/private"
PKI_CERTS_PATH="/etc/swanctl/x509"
PKI_CA_PATH="/etc/swanctl/x509ca"
PKI_CRL_PATH="/etc/swanctl/x509crl"

# Services
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"
```

---

## 2. Project Architecture

### Directory Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (REST endpoints)
│   │   ├── auth/          # Authentication endpoints
│   │   ├── certificates/  # Certificate management
│   │   ├── vpn/           # VPN configuration
│   │   ├── pki/           # PKI management
│   │   └── ...            # Other API modules
│   ├── (pages)/           # Page routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
│
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   ├── dashboard/        # Dashboard components
│   ├── pki/              # PKI management UI
│   ├── vpn/              # VPN management UI
│   └── ...               # Feature-specific components
│
├── lib/                   # Core libraries
│   ├── db.ts             # Prisma client
│   ├── utils.ts          # Utility functions
│   ├── pki/              # PKI operations
│   │   ├── openssl.ts    # OpenSSL wrapper
│   │   ├── strongswan.ts # strongSwan integration
│   │   └── config.ts     # PKI configuration
│   ├── vpn/              # VPN operations
│   │   ├── monitor.ts    # VPN monitoring
│   │   ├── profiles.ts   # Connection profiles
│   │   └── site-to-site.ts # Site-to-Site VPN
│   ├── middleware/       # Security middleware
│   └── email/            # Email services
│
├── hooks/                 # React hooks
│   ├── use-auth.ts       # Authentication hook
│   ├── use-csrf.ts       # CSRF protection hook
│   └── ...               # Other hooks
│
└── middleware.ts          # Next.js middleware

mini-services/             # Background services
├── crl-scheduler/        # CRL auto-fetch service (Port 3031)
├── cert-renewal/         # Certificate renewal (Port 3032)
└── ocsp-responder/       # OCSP responder (Port 3033)

docs/                      # Documentation
├── product/              # Product documentation
├── developer/            # Developer guides
├── api/                  # API documentation
└── guides/               # Setup guides

prisma/                    # Database schema
├── schema.prisma         # Prisma schema
└── seed.ts               # Database seeding
```

### Technology Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | SQLite (Prisma ORM) |
| UI Components | shadcn/ui (Radix) |
| Styling | Tailwind CSS 4 |
| State Management | Zustand |
| Form Handling | React Hook Form + Zod |
| Authentication | JWT + bcrypt |
| Charts | Recharts |

---

## 3. Coding Standards

### TypeScript Guidelines
```typescript
// Use strict typing
interface User {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
}

// Prefer interfaces for objects, types for unions
type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

// Use enums for fixed values
enum CertificateStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  PENDING = 'PENDING'
}

// Avoid 'any' - use 'unknown' when type is uncertain
function parseJson(input: string): unknown {
  return JSON.parse(input);
}
```

### Component Standards
```typescript
// Use named exports for components
export function UserCard({ user }: UserCardProps) {
  // ...
}

// Define props interface
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
  className?: string;
}

// Use shadcn/ui components
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Use cn() for conditional classes
import { cn } from '@/lib/utils';

// Example component
export function StatusBadge({ status }: { status: CertificateStatus }) {
  return (
    <Badge
      variant={status === 'ACTIVE' ? 'success' : 'destructive'}
      className={cn(
        'font-medium',
        status === 'EXPIRED' && 'bg-yellow-500'
      )}
    >
      {status}
    </Badge>
  );
}
```

### API Route Standards
```typescript
// Standard API response format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Use consistent error handling
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Always include audit logging
await db.auditLog.create({
  data: {
    action: 'CREATE_USER',
    category: 'USER_MANAGEMENT',
    actorId: session.userId,
    targetId: user.id,
    targetType: 'VpnUser',
    details: JSON.stringify({ username: user.username }),
    ipAddress: request.headers.get('x-forwarded-for'),
  }
});
```

### File Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case | `user-card.tsx` |
| API Routes | RESTful | `/api/users/[id]/route.ts` |
| Libraries | kebab-case | `openssl.ts` |
| Hooks | camelCase with 'use' prefix | `use-auth.ts` |
| Types/Interfaces | PascalCase | `User`, `ApiResponse` |

---

## 4. API Development

### RESTful Endpoints
```
GET    /api/users           - List all users
POST   /api/users           - Create new user
GET    /api/users/:id       - Get single user
PUT    /api/users/:id       - Update user
DELETE /api/users/:id       - Delete user

GET    /api/certificates    - List certificates
POST   /api/certificates    - Generate certificate
POST   /api/certificates/renew - Renew certificate
```

### Request/Response Patterns
```typescript
// Paginated list response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Query parameters
interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

### Error Handling
```typescript
// HTTP Status Codes
// 200 - Success
// 201 - Created
// 400 - Bad Request (validation error)
// 401 - Unauthorized
// 403 - Forbidden
// 404 - Not Found
// 409 - Conflict (duplicate)
// 429 - Too Many Requests (rate limited)
// 500 - Internal Server Error

// Standard error response
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "username": "Username is required",
    "email": "Invalid email format"
  }
}
```

---

## 5. Frontend Development

### Component Patterns
```typescript
// Page component (Server Component)
// src/app/users/page.tsx
export default async function UsersPage() {
  return <UsersContent />;
}

// Content component (Client Component)
// src/components/users/users-content.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function UsersContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

### State Management
```typescript
// Zustand store
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
```

### Form Handling
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define schema
const userSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

// Use in component
const form = useForm<UserFormData>({
  resolver: zodResolver(userSchema),
  defaultValues: {
    username: '',
    email: '',
  },
});

const onSubmit = async (data: UserFormData) => {
  // Submit logic
};
```

---

## 6. Database Operations

### Prisma Best Practices
```typescript
// Import db client
import { db } from '@/lib/db';

// Use transactions for related operations
await db.$transaction(async (tx) => {
  const user = await tx.vpnUser.create({
    data: { username, email },
  });

  await tx.certificate.create({
    data: { userId: user.id, ...certData },
  });
});

// Use select for performance
const users = await db.vpnUser.findMany({
  select: {
    id: true,
    username: true,
    email: true,
    certificates: {
      select: {
        id: true,
        commonName: true,
        status: true,
      },
    },
  },
});

// Use include sparingly
const userWithCerts = await db.vpnUser.findUnique({
  where: { id },
  include: { certificates: true },
});
```

### Schema Changes
```bash
# Edit prisma/schema.prisma
# Then push changes
bun run db:push

# Generate client
bun run db:generate
```

---

## 7. Mini-Services Development

### Service Template
```typescript
// mini-services/my-service/index.ts
import { serve } from 'bun';

const PORT = 3034; // Unique port

const server = serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      return Response.json({ status: 'running', port: PORT });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(`Service running on port ${PORT}`);
```

### Service Configuration
```json
// mini-services/my-service/package.json
{
  "name": "my-service",
  "scripts": {
    "dev": "bun --hot index.ts",
    "start": "bun index.ts"
  },
  "dependencies": {}
}
```

### Service Communication
```typescript
// From main app to mini-service
const response = await fetch(`/api/my-endpoint?XTransformPort=3034`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

---

## 8. Testing & Quality Assurance

### Linting
```bash
# Run ESLint
bun run lint

# Fix linting issues
bun run lint --fix
```

### Manual Testing Checklist
- [ ] All API endpoints respond correctly
- [ ] Form validations work
- [ ] Error messages are clear
- [ ] Loading states display properly
- [ ] Responsive design works
- [ ] Dark/light mode switches correctly
- [ ] Audit logs are created
- [ ] CSRF protection works

---

## 9. Deployment Guidelines

### Pre-deployment Checklist
- [ ] Run `bun run lint` - no errors
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Create backup
- [ ] Test all critical paths

### Deployment Steps
```bash
# 1. Create backup
tar -czvf backup_$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  src/ prisma/ mini-services/

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
bun install

# 4. Run database migrations
bun run db:push

# 5. Build application
bun run build

# 6. Restart services
systemctl restart vpn-pki
systemctl restart crl-scheduler
systemctl restart cert-renewal
systemctl restart ocsp-responder
```

---

## 10. Security Best Practices

### Authentication
```typescript
// Always verify JWT
const decoded = jwt.verify(token, JWT_SECRET);

// Hash passwords with bcrypt
const hash = await bcrypt.hash(password, 12);

// Compare securely
const isValid = await bcrypt.compare(password, hash);
```

### Input Validation
```typescript
// Always validate with Zod
const schema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(12),
});
```

### SQL Injection Prevention
```typescript
// Always use Prisma parameterized queries
// SAFE - Prisma handles escaping
await db.user.findFirst({
  where: { username: userInput },
});

// NEVER do raw string interpolation
// UNSAFE - DO NOT DO THIS
await db.$queryRaw`SELECT * FROM users WHERE username = ${userInput}`;
```

### File Operations
```typescript
// Validate file paths
const safePath = path.join(SAFE_BASE_DIR, filename);
if (!safePath.startsWith(SAFE_BASE_DIR)) {
  throw new Error('Invalid path');
}

// Set proper permissions
fs.chmodSync(keyPath, 0o600); // Private keys
fs.chmodSync(certPath, 0o644); // Certificates
```

---

## Quick Reference

### Common Commands
```bash
bun run dev          # Start development server
bun run lint         # Run ESLint
bun run db:push      # Push schema changes
bun run db:generate  # Generate Prisma client
bun run build        # Build for production
```

### Debugging
```bash
# Check logs
tail -f dev.log

# Check service status
curl http://localhost:3031/status
curl http://localhost:3032/status
curl http://localhost:3033/status
```

---

*Last Updated: 2024*
*Version: 1.0.0*
