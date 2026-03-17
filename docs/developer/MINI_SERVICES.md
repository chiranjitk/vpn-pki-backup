# Mini-Services Documentation

## Overview

The VPN PKI Management Platform includes three background services that run independently from the main application. These services handle time-sensitive operations that require continuous monitoring or scheduled execution.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Application                          │
│                     (Port 3000)                               │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │  Dashboard   │ │    PKI       │ │    VPN       │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (via Gateway)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  CRL Scheduler  │ │  Cert Renewal  │ │  OCSP Responder │
│  (Port 3031)    │ │  (Port 3032)   │ │  (Port 3033)    │
│                 │ │                 │ │                 │
│  - Fetch CRLs   │ │  - Check certs │ │  - OCSP status  │
│  - Auto-update  │ │  - Auto-renew  │ │  - Real-time    │
│  - Retry logic  │ │  - Notify      │ │  - Validate     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Service 1: CRL Scheduler

### Purpose
Automatically fetches Certificate Revocation Lists (CRLs) from external Certificate Authorities and deploys them to strongSwan.

### Port
`3031`

### Location
`mini-services/crl-scheduler/`

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Check Interval | 1 hour | How often to check for updates |
| Retry Attempts | 3 | Number of retries on failure |
| Retry Delay | 1s (exponential) | Base delay between retries |

### API Endpoints

#### GET /status
Returns scheduler status and statistics.

**Response:**
```json
{
  "running": true,
  "lastCheck": "2024-01-01T12:00:00Z",
  "nextCheck": "2024-01-01T13:00:00Z",
  "totalFetches": 100,
  "successfulFetches": 98,
  "failedFetches": 2,
  "lastError": null
}
```

#### GET /logs
Returns operation logs.

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "caId": "clx123...",
      "caName": "External CA",
      "status": "success",
      "message": "CRL fetched successfully"
    }
  ]
}
```

#### GET /cas
Lists all external CAs with CRL URLs.

**Response:**
```json
{
  "cas": [
    {
      "id": "clx123...",
      "name": "External CA",
      "crlUrl": "http://pki.example.com/crl.crl",
      "lastFetch": "2024-01-01T12:00:00Z",
      "nextFetch": "2024-01-01T13:00:00Z"
    }
  ]
}
```

#### POST /start
Starts the scheduler.

#### POST /stop
Stops the scheduler.

#### POST /fetch/:caId
Forces immediate CRL fetch for specific CA.

#### POST /check
Runs a check cycle immediately.

#### PUT /interval/:caId
Updates fetch interval for a CA.

**Request Body:**
```json
{
  "intervalHours": 12
}
```

### Operation Flow

```
1. Load external CAs with CRL URLs from database
2. For each CA:
   a. Check if fetch is due
   b. If due, fetch CRL from URL
   c. Validate CRL format (PEM/DER)
   d. Convert DER to PEM if needed
   e. Validate with OpenSSL
   f. Store in /etc/swanctl/x509crl/
   g. Update database timestamps
   h. Trigger strongSwan reload
3. Log results
4. Sleep until next interval
```

### Error Handling

| Error | Action |
|-------|--------|
| Network timeout | Retry with exponential backoff |
| Invalid CRL format | Log error, skip this cycle |
| CRL validation failed | Log error, keep old CRL |
| strongSwan reload failed | Log warning, continue |

---

## Service 2: Certificate Renewal

### Purpose
Monitors certificate expiry dates and automatically renews certificates before expiration.

### Port
`3032`

### Location
`mini-services/cert-renewal/`

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Check Interval | 24 hours | Daily check |
| Renewal Window | 30 days | Days before expiry to renew |
| Notify Days | 60,30,14,7 | Days to send notifications |
| Auto-Renew | false | Manual approval required |

### API Endpoints

#### GET /status
Returns renewal service status.

**Response:**
```json
{
  "running": true,
  "lastCheck": "2024-01-01T00:00:00Z",
  "nextCheck": "2024-01-02T00:00:00Z",
  "autoRenewEnabled": false,
  "renewalWindowDays": 30,
  "stats": {
    "totalChecked": 500,
    "expiring": 15,
    "renewed": 5,
    "pending": 10
  }
}
```

#### GET /expiring
Lists certificates expiring soon.

**Response:**
```json
{
  "certificates": [
    {
      "id": "clx123...",
      "type": "client",
      "commonName": "user@example.com",
      "expiryDate": "2024-02-01T00:00:00Z",
      "daysRemaining": 15,
      "userId": "clx456...",
      "username": "user"
    }
  ]
}
```

#### GET /logs
Returns renewal operation logs.

#### POST /check
Runs immediate check cycle.

#### POST /start
Starts the scheduler.

#### POST /stop
Stops the scheduler.

#### POST /renew/:certId
Forces renewal of specific certificate.

**Request Body:**
```json
{
  "type": "client"
}
```

**Response:**
```json
{
  "success": true,
  "certificate": {
    "id": "clx789...",
    "serialNumber": "02",
    "commonName": "user@example.com",
    "expiryDate": "2025-01-01T00:00:00Z"
  },
  "download": {
    "pfx": "/api/certificates/clx789.../download?format=pfx"
  },
  "pfxPassword": "generated-password"
}
```

#### PUT /config
Updates renewal configuration.

**Request Body:**
```json
{
  "enabled": true,
  "daysBeforeExpiry": 30,
  "notifyDays": "60,30,14,7",
  "autoRenew": false
}
```

### Renewal Flow

```
1. Query certificates expiring within notify period
2. For each certificate:
   a. Check if notification needed
   b. If in notification window, create notification + send email
   c. If in renewal window:
      - Auto-renew mode: Generate new certificate
      - Manual mode: Create approval notification
3. For renewal:
   a. Generate new RSA key pair
   b. Create CSR with same attributes
   c. Sign with managed CA
   d. Create PKCS#12 bundle
   e. Update database
   f. Mark old certificate as EXPIRED
   g. Log to audit table
```

### Certificate Types

| Type | Default Validity | Renewal Strategy |
|------|------------------|------------------|
| Client | 365 days | Issue new certificate |
| Server | 730 days | Issue new certificate |
| CA | 10-20 years | Manual renewal |

### Notification Templates

**Email Notification:**
```
Subject: Certificate Expiring Soon

Your VPN certificate will expire in {days} days.

Certificate Details:
- Common Name: {cn}
- Serial Number: {serial}
- Expiry Date: {expiry}

Please contact your administrator for renewal.
```

---

## Service 3: OCSP Responder

### Purpose
Provides real-time Online Certificate Status Protocol (OCSP) responses for certificate validation.

### Port
`3033`

### Location
`mini-services/ocsp-responder/`

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Signing CA | Default CA | CA used to sign OCSP responses |
| Cache TTL | 5 minutes | Response cache duration |

### API Endpoints

#### POST /
Standard OCSP request (binary).

**Request:** OCSP request in binary format
**Response:** OCSP response in binary format

#### GET /{base64-request}
GET-based OCSP request.

**Request:** Base64-encoded OCSP request
**Response:** OCSP response in binary format

#### GET /status
Returns responder status.

**Response:**
```json
{
  "running": true,
  "signingCa": "VPN Intermediate CA",
  "responsesServed": 1000,
  "cacheSize": 50,
  "lastError": null
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "uptime": 86400
}
```

#### GET /certificates
Lists all certificates with OCSP status.

**Response:**
```json
{
  "certificates": [
    {
      "serialNumber": "01",
      "status": "good",
      "thisUpdate": "2024-01-01T12:00:00Z",
      "nextUpdate": "2024-01-01T13:00:00Z"
    }
  ]
}
```

#### GET /check/{serialNumber}
Check specific certificate status.

**Response:**
```json
{
  "serialNumber": "01",
  "status": "good",
  "thisUpdate": "2024-01-01T12:00:00Z",
  "nextUpdate": "2024-01-01T13:00:00Z"
}
```

### OCSP Response Status

| Status | Description |
|--------|-------------|
| good | Certificate is valid |
| revoked | Certificate has been revoked |
| unknown | Certificate not found |

### Response Signing

OCSP responses are signed with the issuing CA's private key to ensure authenticity.

### Integration

**Authority Information Access Extension:**
```
OCSP - URI:http://vpn.example.com:3033/
```

**Certificate Validation Flow:**
```
1. Client receives certificate
2. Extracts OCSP URL from AIA extension
3. Constructs OCSP request with cert serial number
4. Sends request to OCSP responder
5. Receives signed response
6. Verifies signature with CA certificate
7. Checks certificate status
```

---

## Communication Pattern

### From Main Application

All communication with mini-services goes through the gateway with port transformation:

```typescript
// Example: Fetch CRL scheduler status
const response = await fetch('/api/crl/scheduler?XTransformPort=3031')

// Example: Check renewal status
const response = await fetch('/api/certificates/renewal?XTransformPort=3032')
```

### Error Handling

When a mini-service is unavailable:

```typescript
try {
  const res = await fetch('/api/service?XTransformPort=3031')
  // Process response
} catch (error) {
  // Graceful degradation
  return {
    error: 'Service temporarily unavailable',
    fallback: true
  }
}
```

---

## Systemd Service Configuration

### CRL Scheduler

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
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Certificate Renewal

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
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### OCSP Responder

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
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Service Management

```bash
# Enable all services
sudo systemctl enable vpn-crl vpn-renewal vpn-ocsp

# Start all services
sudo systemctl start vpn-crl vpn-renewal vpn-ocsp

# Check status
sudo systemctl status vpn-crl vpn-renewal vpn-ocsp

# View logs
journalctl -u vpn-crl -f
journalctl -u vpn-renewal -f
journalctl -u vpn-ocsp -f
```

---

## Monitoring

### Health Checks

Each service provides a health endpoint:

```bash
# CRL Scheduler
curl http://localhost:3031/status

# Certificate Renewal
curl http://localhost:3032/status

# OCSP Responder
curl http://localhost:3033/health
```

### Log Aggregation

Services log to systemd journal:

```bash
# View all service logs
journalctl -u "vpn-*" -f
```

### Metrics

Each service tracks:
- Requests processed
- Success/failure rates
- Average response time
- Last error

---

## Troubleshooting

### Service Won't Start

1. Check port availability:
   ```bash
   netstat -tlnp | grep -E "3031|3032|3033"
   ```

2. Check logs:
   ```bash
   journalctl -u vpn-crl -n 50
   ```

3. Verify working directory:
   ```bash
   ls -la /opt/vpn-pki-platform/mini-services/crl-scheduler
   ```

### Service Crashes

1. Check memory usage
2. Review error logs
3. Verify database connectivity
4. Check file permissions

### Performance Issues

1. Increase check intervals
2. Optimize database queries
3. Review network connectivity
4. Check CPU usage

---

*Last Updated: 2024*
