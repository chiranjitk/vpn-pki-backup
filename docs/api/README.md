# API Documentation

## Overview

The VPN PKI Management Platform provides a comprehensive REST API for all management operations. All endpoints return JSON responses and require authentication unless otherwise noted.

---

## Authentication

### Base URL
```
http://localhost:3000/api
```

### Authentication Header
```http
Authorization: Bearer <jwt_token>
```

### CSRF Protection
All mutation requests (POST, PUT, DELETE) require CSRF token:

```http
X-CSRF-Token: <csrf_token>
```

---

## Table of Contents

1. [Authentication API](#1-authentication-api)
2. [Certificate API](#2-certificate-api)
3. [VPN Management API](#3-vpn-management-api)
4. [Site-to-Site VPN API](#4-site-to-site-vpn-api)
5. [User Management API](#5-user-management-api)
6. [Firewall API](#6-firewall-api)
7. [System API](#7-system-api)
8. [Metrics API](#8-metrics-api)

---

## 1. Authentication API

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "clx123...",
    "username": "admin",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

### Get CSRF Token
```http
GET /api/auth/csrf
```

**Response:**
```json
{
  "token": "abc123...",
  "expiresAt": "2024-01-01T12:00:00Z"
}
```

### Logout
```http
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true
}
```

### 2FA Status
```http
GET /api/auth/2fa/status
```

**Response:**
```json
{
  "enabled": true,
  "configured": true
}
```

### 2FA Setup
```http
POST /api/auth/2fa/setup
```

**Response:**
```json
{
  "secret": "ABCD1234EFGH5678",
  "qrCode": "data:image/png;base64,..."
}
```

---

## 2. Certificate API

### List Certificates
```http
GET /api/certificates
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (ACTIVE, EXPIRED, REVOKED) |
| userId | string | Filter by user ID |
| search | string | Search by common name |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "certificates": [
    {
      "id": "clx123...",
      "serialNumber": "01",
      "commonName": "user@example.com",
      "subject": "CN=user@example.com",
      "issuer": "CN=VPN CA",
      "issueDate": "2024-01-01T00:00:00Z",
      "expiryDate": "2025-01-01T00:00:00Z",
      "status": "ACTIVE",
      "user": {
        "id": "clx456...",
        "username": "user"
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### Generate Certificate
```http
POST /api/certificates
```

**Request Body:**
```json
{
  "userId": "clx456...",
  "commonName": "user@example.com",
  "keySize": 4096,
  "validityDays": 365,
  "san": ["user@example.com", "user.vpn.local"],
  "ekus": ["clientAuth", "emailProtection"]
}
```

**Response:**
```json
{
  "certificate": {
    "id": "clx789...",
    "serialNumber": "02",
    "commonName": "user@example.com",
    "status": "ACTIVE"
  },
  "download": {
    "pem": "/api/certificates/clx789.../download?format=pem",
    "pfx": "/api/certificates/clx789.../download?format=pfx"
  },
  "pfxPassword": "random-password-123"
}
```

### Revoke Certificate
```http
POST /api/certificates/{id}/revoke
```

**Request Body:**
```json
{
  "reason": "KEY_COMPROMISE",
  "notes": "User reported lost device"
}
```

**Response:**
```json
{
  "success": true,
  "revocation": {
    "id": "clxabc...",
    "certificateId": "clx789...",
    "reason": "KEY_COMPROMISE",
    "revokedAt": "2024-01-01T12:00:00Z"
  }
}
```

### Download Certificate
```http
GET /api/certificates/{id}/download
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| format | string | pem, pfx, or key |

**Response:** Binary file download

### Upload Signed Certificate
```http
POST /api/certificates/upload
```

**Request Body:**
```json
{
  "type": "client",
  "csrId": "clxdef...",
  "certificatePem": "-----BEGIN CERTIFICATE-----\n...",
  "chainPem": "-----BEGIN CERTIFICATE-----\n..."
}
```

---

## 3. VPN Management API

### List Connection Profiles
```http
GET /api/vpn/profiles
```

**Response:**
```json
{
  "profiles": [
    {
      "id": "clx123...",
      "name": "Default IKEv2",
      "connectionName": "ikev2-cert",
      "ikeVersion": 2,
      "clientAuthMode": "MANAGED_CERT",
      "isEnabled": true,
      "isDefault": true,
      "poolName": "vpn-pool",
      "dnsServers": "8.8.8.8"
    }
  ]
}
```

### Create Connection Profile
```http
POST /api/vpn/profiles
```

**Request Body:**
```json
{
  "name": "External CA Profile",
  "connectionName": "external-cert",
  "ikeVersion": 2,
  "clientAuthMode": "EXTERNAL_CERT_RADIUS",
  "ikeProposals": "aes256-sha256-modp2048",
  "espProposals": "aes256-sha256",
  "poolName": "vpn-pool",
  "poolAddressRange": "10.70.0.0/24",
  "dnsServers": "8.8.8.8",
  "mobike": true,
  "dpdTimeout": 30
}
```

### Apply Profile Configuration
```http
POST /api/vpn/profiles
```

**Request Body:**
```json
{
  "action": "apply",
  "id": "clx123..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile applied successfully",
  "configPath": "/etc/swanctl/conf.d/ikev2-cert.conf"
}
```

### Preview Configuration
```http
GET /api/vpn/profiles?preview=true&id=clx123...
```

**Response:**
```json
{
  "config": "# Connection Profile: Default IKEv2\nconnections {\n  ikev2-cert {\n    version = 2\n    ...\n  }\n}"
}
```

### VPN Status
```http
GET /api/vpn/status
```

**Response:**
```json
{
  "service": {
    "status": "RUNNING",
    "uptime": 86400,
    "version": "6.0.1"
  },
  "connections": [
    {
      "username": "user@example.com",
      "sourceIp": "203.0.113.50",
      "virtualIp": "10.70.0.10",
      "connectedAt": "2024-01-01T10:00:00Z",
      "bytesIn": 1048576,
      "bytesOut": 2097152
    }
  ],
  "stats": {
    "totalConnections": 45,
    "uniqueUsers": 42
  }
}
```

### IP Pools
```http
GET /api/vpn/ip-pools
POST /api/vpn/ip-pools
```

**Create Pool:**
```json
{
  "name": "contractors",
  "cidr": "10.80.0.0/24",
  "dnsServers": "8.8.8.8",
  "autoAllocate": true
}
```

### Tunnel Templates
```http
GET /api/vpn/tunnel-templates
POST /api/vpn/tunnel-templates
```

**Create Template:**
```json
{
  "name": "Corporate Split Tunnel",
  "type": "SPLIT_TUNNEL",
  "includedRoutes": "10.0.0.0/8,192.168.0.0/16",
  "dnsServers": "10.0.0.1"
}
```

---

## 4. Site-to-Site VPN API

### List Remote Gateways
```http
GET /api/vpn/site-to-site/gateways
```

**Response:**
```json
{
  "gateways": [
    {
      "id": "clx123...",
      "name": "Branch Office NY",
      "peerIp": "203.0.113.50",
      "authMethod": "PSK",
      "ikeVersion": 2,
      "status": "UP",
      "tunnelCount": 2,
      "isEnabled": true
    }
  ]
}
```

### Create Remote Gateway
```http
POST /api/vpn/site-to-site/gateways
```

**Request Body:**
```json
{
  "name": "Branch Office NY",
  "peerIp": "203.0.113.50",
  "authMethod": "PSK",
  "psk": "secret-key-here",
  "ikeVersion": 2,
  "ikeProposals": "aes256-sha256-modp2048",
  "espProposals": "aes256-sha256",
  "dpdEnabled": true
}
```

### Generate PSK
```http
POST /api/vpn/site-to-site/gateways
```

**Request Body:**
```json
{
  "action": "generate-psk",
  "length": 32
}
```

**Response:**
```json
{
  "psk": "aBc123XyZ!@#..."
}
```

### List Site-to-Site Tunnels
```http
GET /api/vpn/site-to-site/tunnels
```

**Response:**
```json
{
  "tunnels": [
    {
      "id": "clx123...",
      "name": "HQ to Branch NY",
      "localSubnets": "192.168.1.0/24",
      "remoteSubnets": "192.168.2.0/24",
      "status": "UP",
      "bytesIn": 104857600,
      "bytesOut": 209715200
    }
  ]
}
```

### Create Site-to-Site Tunnel
```http
POST /api/vpn/site-to-site/tunnels
```

**Request Body:**
```json
{
  "name": "HQ to Branch NY",
  "gatewayId": "clx456...",
  "localSubnets": "192.168.1.0/24",
  "remoteSubnets": "192.168.2.0/24",
  "startAction": "start"
}
```

### Tunnel Monitoring
```http
GET /api/vpn/site-to-site/monitoring
```

**Response:**
```json
{
  "monitoring": [
    {
      "tunnelId": "clx123...",
      "status": "UP",
      "latencyMs": 25.5,
      "throughputInBps": 1048576,
      "throughputOutBps": 524288,
      "connectionScore": 95
    }
  ]
}
```

---

## 5. User Management API

### List VPN Users
```http
GET /api/users
```

**Response:**
```json
{
  "users": [
    {
      "id": "clx123...",
      "username": "jdoe",
      "email": "jdoe@example.com",
      "fullName": "John Doe",
      "status": "ACTIVE",
      "certificateCount": 2
    }
  ]
}
```

### Create VPN User
```http
POST /api/users
```

**Request Body:**
```json
{
  "username": "jdoe",
  "email": "jdoe@example.com",
  "fullName": "John Doe",
  "department": "Engineering"
}
```

### Admin Users
```http
GET /api/admin-users
POST /api/admin-users
PUT /api/admin-users
DELETE /api/admin-users?id=clx123...
```

**Roles:**
- `SUPER_ADMIN` - Full system access
- `ADMIN` - Administrative access
- `OPERATOR` - Day-to-day operations
- `VIEWER` - Read-only access

### Guest Users
```http
GET /api/guest-users
POST /api/guest-users
POST /api/guest-users/{id}/approve
POST /api/guest-users/{id}/revoke
```

---

## 6. Firewall API

### List Firewall Rules
```http
GET /api/firewall/rules
```

**Response:**
```json
{
  "rules": [
    {
      "id": "clx123...",
      "name": "Allow VPN UDP",
      "action": "ALLOW",
      "protocol": "UDP",
      "destPort": 500,
      "isEnabled": true,
      "priority": 100
    }
  ]
}
```

### Create Firewall Rule
```http
POST /api/firewall/rules
```

**Request Body:**
```json
{
  "name": "Allow VPN UDP 500",
  "action": "ALLOW",
  "protocol": "UDP",
  "destPort": 500,
  "sourceIp": "0.0.0.0/0",
  "priority": 100
}
```

### NAT Policies
```http
GET /api/firewall/nat
POST /api/firewall/nat
```

---

## 7. System API

### Dashboard Statistics
```http
GET /api/dashboard
```

**Response:**
```json
{
  "vpnUsers": {
    "total": 150,
    "active": 142
  },
  "certificates": {
    "total": 200,
    "active": 180,
    "expiring": 15
  },
  "vpnStatus": {
    "status": "RUNNING",
    "activeConnections": 45
  }
}
```

### Audit Logs
```http
GET /api/audit
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| action | string | Filter by action |
| startDate | string | Start date (ISO 8601) |
| endDate | string | End date (ISO 8601) |

### Backup Management
```http
GET /api/backup
POST /api/backup
GET /api/backup/{id}/download
POST /api/backup/{id}/restore
```

### API Keys
```http
GET /api/api-keys
POST /api/api-keys
DELETE /api/api-keys?id=clx123...
```

### Notifications
```http
GET /api/notifications
DELETE /api/notifications/{id}
POST /api/notifications/clear
```

---

## 8. Metrics API

### System Metrics
```http
GET /api/metrics
```

**Response:**
```json
{
  "cpu": { "usage": 45.5 },
  "memory": { "used": 4096, "total": 8192 },
  "disk": { "used": 50, "total": 100 }
}
```

### VPN Traffic Metrics
```http
GET /api/metrics/vpn-traffic
```

### Certificate Trends
```http
GET /api/metrics/cert-trends
```

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "details": {
    "field": "Additional information"
  }
}
```

### HTTP Status Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704110400
```

### Rate Limits
| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Login | 5 | 1 minute |
| Certificate Generation | 10 | 1 minute |
| VPN Operations | 30 | 1 minute |
| General API | 100 | 1 minute |

---

*Last Updated: 2024*
