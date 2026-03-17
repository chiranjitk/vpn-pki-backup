# Database Schema Documentation

## Overview

The VPN PKI Management Platform uses SQLite with Prisma ORM. This document provides a complete reference of all database models, relationships, and indexing strategies.

---

## Database Configuration

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:../db/custom.db"
}
```

**Location:** `db/custom.db`

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│   AdminUser     │       │    VpnUser      │
│─────────────────│       │─────────────────│
│ id              │       │ id              │
│ username        │       │ username        │
│ email           │       │ email           │
│ passwordHash    │       │ status          │
│ role            │       └────────┬────────┘
│ status          │                │
└────────┬────────┘                │ 1:N
         │                         │
         │ 1:N            ┌────────▼────────┐
         │                │   Certificate   │
         │                │─────────────────│
         └───────────────►│ id              │
                          │ userId          │
                          │ serialNumber    │
                          │ commonName      │
                          │ status          │
                          └────────┬────────┘
                                   │ 1:1
                          ┌────────▼────────┐
                          │   Revocation    │
                          │─────────────────│
                          │ certificateId   │
                          │ reason          │
                          │ revokedAt       │
                          └─────────────────┘
```

---

## Models Reference

### User Management Models

#### AdminUser

Administrative users with system access.

```prisma
model AdminUser {
  id                String      @id @default(cuid())
  username          String      @unique
  email             String      @unique
  passwordHash      String
  role              AdminRole   @default(ADMIN)
  status            AdminStatus @default(ACTIVE)
  twoFactorEnabled  Boolean     @default(false)
  twoFactorSecret   String?
  lastLoginAt       DateTime?
  isProtected       Boolean     @default(false)
  protectionReason  String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  auditLogs         AuditLog[]

  @@index([username])
  @@index([email])
  @@index([isProtected])
}
```

**Roles:**
| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full system access |
| ADMIN | Administrative access |
| OPERATOR | Day-to-day operations |
| VIEWER | Read-only access |

#### VpnUser

VPN end users with certificate assignments.

```prisma
model VpnUser {
  id          String          @id @default(cuid())
  username    String          @unique
  email       String?
  fullName    String?
  department  String?
  phone       String?
  notes       String?
  status      VpnUserStatus   @default(ACTIVE)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  certificates Certificate[]

  @@index([username])
  @@index([status])
}
```

#### GuestUser

Time-limited access users.

```prisma
model GuestUser {
  id            String          @id @default(cuid())
  username      String          @unique
  email         String
  fullName      String?
  phone         String?
  company       String?
  purpose       String?
  sponsoredBy   String?
  validFrom     DateTime
  validUntil    DateTime
  status        GuestUserStatus @default(PENDING)
  certificateId String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([username])
  @@index([status])
  @@index([validUntil])
}
```

---

### PKI Models

#### CertificateAuthority

CA certificates for certificate signing.

```prisma
model CertificateAuthority {
  id                    String      @id @default(cuid())
  name                  String
  type                  CAType
  status                CAStatus    @default(ACTIVE)
  isDefault             Boolean     @default(false)
  isExternal            Boolean     @default(false)
  crlUrl                String?
  crlLastFetch          DateTime?
  crlNextFetch          DateTime?
  keyPath               String?
  certificatePath       String?
  chainPath             String?
  crlPath               String?
  subject               String?
  serialNumber          String?
  issueDate             DateTime?
  expiryDate            DateTime?
  keySize               Int?
  defaultValidityDays   Int         @default(365)
  crlValidityDays       Int         @default(7)
  crlInfo               CrlInfo?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  @@index([type])
  @@index([isDefault])
}
```

#### Certificate

Client and server certificates.

```prisma
model Certificate {
  id                String             @id @default(cuid())
  userId            String
  user              VpnUser            @relation(fields: [userId], references: [id], onDelete: Cascade)
  serialNumber      String             @unique
  commonName        String
  subject           String
  issuer            String
  issueDate         DateTime
  expiryDate        DateTime
  status            CertificateStatus  @default(ACTIVE)
  certificatePath   String?
  keyPath           String?
  csrPath           String?
  pfxPath           String?
  pfxPassword       String?
  keySize           Int                @default(4096)
  signatureAlgorithm String             @default("SHA256")
  certificateType   CertificateType    @default(CLIENT)
  ekus              String
  san               String?
  revocation        Revocation?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([serialNumber])
  @@index([userId])
  @@index([status])
  @@index([expiryDate])
}
```

#### Revocation

Certificate revocation records.

```prisma
model Revocation {
  id              String            @id @default(cuid())
  certificateId   String            @unique
  certificate     Certificate       @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  reason          RevocationReason
  revokedAt       DateTime          @default(now())
  revokedBy       String
  crlPublished    Boolean           @default(false)
  notes           String?
  createdAt       DateTime          @default(now())

  @@index([certificateId])
  @@index([revokedAt])
}
```

#### CrlInfo

CRL metadata and status.

```prisma
model CrlInfo {
  id              String              @id @default(cuid())
  caId            String              @unique
  ca              CertificateAuthority @relation(fields: [caId], references: [id])
  version         Int
  thisUpdate      DateTime
  nextUpdate      DateTime
  revokedCount    Int                 @default(0)
  filePath        String?
  generatedAt     DateTime            @default(now())
  publishedAt     DateTime?
  publishedTo     String?
  createdAt       DateTime            @default(now())

  @@index([caId])
  @@index([nextUpdate])
}
```

---

### VPN Models

#### ConnectionProfile

VPN connection configurations.

```prisma
model ConnectionProfile {
  id                    String              @id @default(cuid())
  name                  String              @unique
  description           String?
  isDefault             Boolean             @default(false)
  isEnabled             Boolean             @default(true)
  connectionName        String              @unique
  ikeVersion            Int                 @default(2)
  ikeProposals          String              @default("aes256-sha256-modp2048,aes256-sha256-modp1024")
  espProposals          String              @default("aes256-sha256")
  localAuth             String              @default("pubkey")
  localCert             String              @default("vpn-server.pem")
  localId               String?
  localAddrs            String?
  clientAuthMode        ClientAuthMode      @default(MANAGED_CERT)
  remoteAuth            String              @default("pubkey")
  remoteCaId            String?
  remoteEapId           String?
  identityMappingId     String?
  identityMapping       IdentityMapping?    @relation(fields: [identityMappingId], references: [id])
  radiusConfigId        String?
  requireRadiusAuth     Boolean             @default(false)
  radiusAccounting      Boolean             @default(false)
  poolId                String?
  poolName              String              @default("vpn-pool")
  poolAddressRange      String              @default("10.70.0.0/24")
  dnsServers            String              @default("8.8.8.8")
  dnsSuffixes           String?
  dnsConfigId           String?
  tunnelTemplateId      String?
  tunnelTemplate        TunnelTemplate?     @relation(fields: [tunnelTemplateId], references: [id])
  localTrafficSelector  String              @default("0.0.0.0/0")
  remoteTrafficSelector String              @default("dynamic")
  mobike                Boolean             @default(true)
  fragmentation         Boolean             @default(true)
  reauthTime            Int                 @default(0)
  dpdTimeout            Int                 @default(30)
  dpdAction             String              @default("restart")
  startAction           String              @default("none")
  serverHostnames       String?
  configApplied         Boolean             @default(false)
  appliedAt             DateTime?
  configPath            String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  vpnSessions           VpnSession[]

  @@index([name])
  @@index([connectionName])
  @@index([isDefault])
  @@index([isEnabled])
  @@index([clientAuthMode])
  @@index([tunnelTemplateId])
}
```

#### VpnSession

Active and historical VPN sessions.

```prisma
model VpnSession {
  id                    String              @id @default(cuid())
  username              String
  profileId             String?
  profile               ConnectionProfile?  @relation(fields: [profileId], references: [id])
  certificateId         String?
  certificateSubject    String?
  certificateSerial     String?
  issuingCaId           String?
  certificateIssuer     String?
  authMethod            AuthMethod?
  radiusUsername        String?
  radiusResponse        String?
  radiusAttributes      String?
  sourceIp              String
  destIp                String?
  bytesIn               Int                 @default(0)
  bytesOut              Int                 @default(0)
  connectedAt           DateTime            @default(now())
  disconnectedAt        DateTime?
  duration              Int?
  status                VpnSessionStatus    @default(ACTIVE)
  virtualIp             String?
  createdAt             DateTime            @default(now())

  @@index([username])
  @@index([status])
  @@index([connectedAt])
  @@index([profileId])
  @@index([authMethod])
  @@index([certificateSerial])
}
```

#### TunnelTemplate

Split/full tunnel configurations.

```prisma
model TunnelTemplate {
  id                    String              @id @default(cuid())
  name                  String              @unique
  description           String?
  type                  TunnelType          @default(SPLIT_TUNNEL)
  includedRoutes        String
  excludedRoutes        String?
  dnsServers            String?
  dnsSuffixes           String?
  pushDefaultRoute      Boolean             @default(false)
  isDefault             Boolean             @default(false)
  isEnabled             Boolean             @default(true)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  connectionProfiles    ConnectionProfile[]

  @@index([name])
  @@index([type])
  @@index([isDefault])
  @@index([isEnabled])
}
```

---

### Site-to-Site Models

#### RemoteGateway

Remote VPN gateway configuration.

```prisma
model RemoteGateway {
  id                    String              @id @default(cuid())
  name                  String              @unique
  description           String?
  peerIp                String
  peerId                String?
  peerHostname          String?
  authMethod            SiteToSiteAuthMethod @default(PSK)
  psk                   String?
  pskType               PskType             @default(RAW)
  localCertId           String?
  remoteCaId            String?
  remoteCertFingerprint String?
  ikeVersion            Int                 @default(2)
  ikeProposals          String              @default("aes256-sha256-modp2048")
  espProposals          String              @default("aes256-sha256")
  dpdEnabled            Boolean             @default(true)
  dpdDelay              Int                 @default(30)
  dpdTimeout            Int                 @default(120)
  dpdAction             String              @default("restart")
  natTraversal          Boolean             @default(true)
  forceNatT             Boolean             @default(false)
  status                GatewayStatus       @default(DOWN)
  lastConnected         DateTime?
  lastDisconnected      DateTime?
  connectionAttempts    Int                 @default(0)
  lastError             String?
  location              String?
  siteName              String?
  contactName           String?
  contactEmail          String?
  isEnabled             Boolean             @default(true)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  tunnels               SiteToSiteTunnel[]

  @@index([name])
  @@index([peerIp])
  @@index([status])
  @@index([isEnabled])
}
```

#### SiteToSiteTunnel

Network-to-network tunnel configuration.

```prisma
model SiteToSiteTunnel {
  id                    String              @id @default(cuid())
  name                  String              @unique
  description           String?
  gatewayId             String
  gateway               RemoteGateway       @relation(fields: [gatewayId], references: [id], onDelete: Cascade)
  connectionName        String              @unique
  localAddrs            String?
  localSubnets          String
  localId               String?
  remoteSubnets         String
  remoteId              String?
  localTrafficSelector  String?
  remoteTrafficSelector String?
  ikeVersion            Int?
  ikeProposals          String?
  espProposals          String?
  tunnelMode            TunnelMode          @default(TUNNEL)
  pfsEnabled            Boolean             @default(true)
  pfsGroup              String              @default("modp2048")
  rekeyTime             Int                 @default(3600)
  reauthTime            Int                 @default(0)
  lifeTime              Int                 @default(28800)
  dpdEnabled            Boolean?
  dpdDelay              Int?
  dpdTimeout            Int?
  dpdAction             String?
  startAction           String              @default("start")
  closeAction           String              @default("none")
  mobike                Boolean             @default(false)
  encapsulation         EncapType           @default(NO)
  configApplied         Boolean             @default(false)
  appliedAt             DateTime?
  configPath            String?
  status                TunnelStatus        @default(DOWN)
  establishedAt         DateTime?
  lastRekeyAt           DateTime?
  bytesIn               Int                 @default(0)
  bytesOut              Int                 @default(0)
  packetsIn             Int                 @default(0)
  packetsOut            Int                 @default(0)
  lastError             String?
  errorCount            Int                 @default(0)
  lastErrorAt           DateTime?
  isEnabled             Boolean             @default(true)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  monitoringData        TunnelMonitoring[]

  @@index([name])
  @@index([gatewayId])
  @@index([status])
  @@index([isEnabled])
  @@index([connectionName])
}
```

#### TunnelMonitoring

Real-time tunnel metrics.

```prisma
model TunnelMonitoring {
  id                    String              @id @default(cuid())
  tunnelId              String
  tunnel                SiteToSiteTunnel    @relation(fields: [tunnelId], references: [id], onDelete: Cascade)
  timestamp             DateTime            @default(now())
  status                TunnelStatus        @default(DOWN)
  latencyMs             Float?
  avgLatencyMs          Float?
  maxLatencyMs          Float?
  minLatencyMs          Float?
  jitterMs              Float?
  throughputInBps       Float?
  throughputOutBps      Float?
  avgThroughputInBps    Float?
  avgThroughputOutBps   Float?
  maxThroughputInBps    Float?
  maxThroughputOutBps   Float?
  bytesIn               Int                 @default(0)
  bytesOut              Int                 @default(0)
  packetsIn             Int                 @default(0)
  packetsOut            Int                 @default(0)
  bytesInDelta          Int                 @default(0)
  bytesOutDelta         Int                 @default(0)
  packetsInDelta        Int                 @default(0)
  packetsOutDelta       Int                 @default(0)
  errorsIn              Int                 @default(0)
  errorsOut             Int                 @default(0)
  errorRate             Float?
  packetLossPercent     Float?
  connectionScore       Int?
  ikeSaState            String?
  childSaState          String?
  spiIn                 String?
  spiOut                String?
  nextRekeyIn           Int?
  saLifeRemaining       Int?
  createdAt             DateTime            @default(now())

  @@index([tunnelId])
  @@index([timestamp])
  @@index([status])
  @@index([tunnelId, timestamp])
}
```

---

### System Models

#### AuditLog

Comprehensive operation logging.

```prisma
model AuditLog {
  id            String        @id @default(cuid())
  action        String
  category      AuditCategory
  actorId       String?
  actor         AdminUser?    @relation(fields: [actorId], references: [id])
  actorType     ActorType     @default(ADMIN)
  targetId      String?
  targetType    String?
  details       String?
  ipAddress     String?
  userAgent     String?
  status        AuditStatus   @default(SUCCESS)
  errorMessage  String?
  createdAt     DateTime      @default(now())

  @@index([action])
  @@index([category])
  @@index([actorId])
  @@index([targetId])
  @@index([createdAt])
}
```

#### Notification

User notifications.

```prisma
model Notification {
  id            String      @id @default(cuid())
  type          String
  referenceId   String?
  title         String
  message       String
  severity      String
  isRead        Boolean     @default(false)
  isDismissed   Boolean     @default(false)
  createdAt     DateTime    @default(now())
  readAt        DateTime?
  dismissedAt   DateTime?

  @@index([type])
  @@index([isRead])
  @@index([isDismissed])
  @@index([createdAt])
}
```

---

## Indexes

### Primary Indexes (automatically created)
- All `@id` fields
- All `@unique` fields

### Secondary Indexes
- Foreign key relationships
- Status fields for filtering
- Date fields for sorting
- Compound indexes for common queries

---

## Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| MetricData (raw) | 7 days |
| MetricDataHourly | 30 days |
| MetricDataDaily | 1+ years |
| TunnelMonitoring | 30 days |
| AuditLog | 90 days (configurable) |
| VpnSession | 1 year |

---

## Migrations

### Run Migrations

```bash
# Generate Prisma client
bun run db:generate

# Push schema changes
bun run db:push

# Create migration (production)
bun run db:migrate
```

### Reset Database

```bash
# Warning: Destroys all data
bun run db:push --force-reset
```

---

*Last Updated: 2024*
