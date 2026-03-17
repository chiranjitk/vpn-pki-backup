# Troubleshooting Guide - VPN PKI Management Platform

## Table of Contents
1. [Common Issues](#1-common-issues)
2. [Authentication Problems](#2-authentication-problems)
3. [Certificate Issues](#3-certificate-issues)
4. [VPN Connection Problems](#4-vpn-connection-problems)
5. [Database Issues](#5-database-issues)
6. [Service Errors](#6-service-errors)
7. [Performance Issues](#7-performance-issues)
8. [Logging & Debugging](#8-logging--debugging)
9. [Error Code Reference](#9-error-code-reference)
10. [Recovery Procedures](#10-recovery-procedures)

---

## 1. Common Issues

### Application Won't Start

**Symptoms:**
- `bun run dev` fails
- Port 3000 already in use
- Database connection errors

**Solutions:**

```bash
# Check if port is in use
lsof -i :3000
kill -9 <PID>

# Check database file exists
ls -la db/custom.db

# Reinstall dependencies
rm -rf node_modules bun.lock
bun install

# Regenerate Prisma client
bun run db:generate

# Check environment variables
cat .env
```

### Build Failures

**Symptoms:**
- `bun run build` fails
- TypeScript errors
- Missing modules

**Solutions:**

```bash
# Clear Next.js cache
rm -rf .next

# Check TypeScript errors
bun run lint

# Verify all imports
# Check for circular dependencies

# Build with verbose output
DEBUG=* bun run build
```

### UI Not Loading

**Symptoms:**
- Blank page
- Hydration errors
- Component crashes

**Solutions:**

```bash
# Check browser console for errors
# Clear browser cache
# Check for client/server component issues

# Common fix: Add 'use client' directive
'use client'; // Add this at top of client components
```

---

## 2. Authentication Problems

### Login Fails

**Symptoms:**
- "Invalid credentials" error
- JWT errors
- Session not persisting

**Diagnostic Steps:**

```bash
# Check if user exists in database
sqlite3 db/custom.db "SELECT * FROM AdminUser WHERE username='admin';"

# Verify password hash format
# Should start with $2b$ or $2a$

# Check JWT_SECRET in .env
echo $JWT_SECRET

# Test JWT generation
node -e "console.log(require('jsonwebtoken').sign({id:'test'}, 'secret'))"
```

**Solutions:**

```typescript
// Reset admin password
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('newpassword', 12);
// Update in database

// Or use the script
bun run scripts/create-admin.ts
```

### Two-Factor Authentication Issues

**Symptoms:**
- TOTP code not accepted
- QR code not displaying
- Locked out of account

**Solutions:**

```bash
# Disable 2FA for user directly in database
sqlite3 db/custom.db "UPDATE AdminUser SET twoFactorEnabled=0, twoFactorSecret=NULL WHERE username='admin';"

# Verify time sync on server
timedatectl status

# Check TOTP algorithm
# Ensure server time is accurate (within 30 seconds)
```

### CSRF Token Errors

**Symptoms:**
- "Invalid CSRF token" errors
- Form submissions fail
- API requests rejected

**Solutions:**

```typescript
// Fetch new CSRF token before request
const csrfResponse = await fetch('/api/auth/csrf');
const { token } = await csrfResponse.json();

// Include in headers
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Rate Limiting Issues

**Symptoms:**
- 429 Too Many Requests
- Login blocked after attempts

**Solutions:**

```typescript
// Check rate limit headers
// X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

// Wait for reset time
// Or restart application to clear in-memory limits

// Adjust limits in src/lib/middleware/rate-limit.ts
const LIMITS = {
  login: { windowMs: 60000, max: 10 }, // Increase if needed
};
```

---

## 3. Certificate Issues

### Certificate Generation Fails

**Symptoms:**
- OpenSSL errors
- Certificate not created
- Invalid certificate format

**Diagnostic Steps:**

```bash
# Check OpenSSL version
openssl version

# Verify CA exists
ls -la /etc/swanctl/x509ca/

# Check permissions
ls -la /etc/swanctl/private/

# Test OpenSSL manually
openssl genrsa -out test.key 4096
openssl req -new -key test.key -out test.csr -subj "/CN=test"
```

**Common Errors:**

```bash
# Error: "unable to write 'random state'"
# Solution: Set RANDFILE environment variable
export RANDFILE=/tmp/.rnd

# Error: "CA certificate not found"
# Solution: Create or import CA first

# Error: "Permission denied"
# Solution: Check file permissions
chmod 600 /etc/swanctl/private/*.pem
chmod 644 /etc/swanctl/x509/*.pem
```

### Certificate Revocation Issues

**Symptoms:**
- CRL not updated
- Revoked certificates still work
- OCSP errors

**Solutions:**

```bash
# Regenerate CRL
curl -X POST http://localhost:3031/fetch

# Check CRL file
openssl crl -in /etc/swanctl/x509crl/*.crl -text -noout

# Verify CRL is valid
openssl verify -CAfile /etc/swanctl/x509ca/root.pem -crl_check \
  /etc/swanctl/x509/client.pem

# Restart services
systemctl restart strongswan
```

### Certificate Renewal Problems

**Symptoms:**
- Auto-renewal not working
- Certificates expiring
- Renewal service down

**Solutions:**

```bash
# Check renewal service status
curl http://localhost:3032/status

# Manual renewal trigger
curl -X POST http://localhost:3032/renew/<certId>

# Check service logs
journalctl -u cert-renewal -f

# Verify PKI mode is MANAGED
# External CA certificates cannot be auto-renewed
```

---

## 4. VPN Connection Problems

### VPN Service Not Running

**Symptoms:**
- strongSwan won't start
- Connection failures
- Service errors

**Diagnostic Steps:**

```bash
# Check service status
systemctl status strongswan
systemctl status strongswan-starter

# Check logs
journalctl -u strongswan -f

# Test configuration
swanctl --load-all
swanctl --list-sas

# Check ports
netstat -tulpn | grep -E '500|4500'
```

**Common Issues:**

```bash
# Issue: Certificate not found
# Check certificate paths in swanctl.conf
ls -la /etc/swanctl/x509/vpn-server.pem

# Issue: Private key permission denied
chmod 600 /etc/swanctl/private/vpn-server.pem

# Issue: CA certificate missing
cp /etc/swanctl/x509ca/*.pem /etc/swanctl/x509ca/
```

### Client Connection Failures

**Symptoms:**
- Clients can't connect
- Authentication errors
- Timeout errors

**Solutions:**

```bash
# Check active connections
swanctl --list-sas

# Check certificate chain
openssl verify -CAfile /etc/swanctl/x509ca/root.pem \
  -untrusted /etc/swanctl/x509ca/intermediate.pem \
  /etc/swanctl/x509/client.pem

# Verify IKE proposals match client
# Check swanctl.conf for ike= and esp= settings

# Test connectivity
ping <vpn-server-ip>
nc -zv <vpn-server-ip> 500
nc -zv <vpn-server-ip> 4500
```

### Site-to-Site Tunnel Issues

**Symptoms:**
- Tunnel not establishing
- Traffic not routing
- DPD failures

**Solutions:**

```bash
# Check tunnel status
curl http://localhost:3031/monitoring

# Verify gateway configuration
# Check PSK or certificate authentication

# Test routing
ip route show table all
ip xfrm state
ip xfrm policy

# Check firewall rules
nft list ruleset
```

---

## 5. Database Issues

### Database Lock Errors

**Symptoms:**
- "Database is locked" errors
- Write operations fail
- Timeout errors

**Solutions:**

```bash
# Check for active connections
fuser db/custom.db

# Kill hanging processes
fuser -k db/custom.db

# Check database integrity
sqlite3 db/custom.db "PRAGMA integrity_check;"

# Backup and recreate if needed
cp db/custom.db db/custom.db.backup
sqlite3 db/custom.db ".dump" | sqlite3 db/custom-new.db
mv db/custom-new.db db/custom.db
```

### Prisma Errors

**Symptoms:**
- "Prisma Client not initialized"
- Schema mismatch errors
- Relation errors

**Solutions:**

```bash
# Regenerate Prisma client
bun run db:generate

# Push schema changes
bun run db:push

# Check schema for errors
npx prisma validate

# Format schema
npx prisma format
```

### Migration Issues

**Symptoms:**
- Migration fails
- Data loss
- Constraint violations

**Solutions:**

```bash
# Reset database (WARNING: Data loss)
bun run db:reset

# Manual migration
sqlite3 db/custom.db < migration.sql

# Check foreign key constraints
sqlite3 db/custom.db "PRAGMA foreign_key_check;"
```

---

## 6. Service Errors

### CRL Scheduler Issues

**Symptoms:**
- CRLs not being fetched
- Service not running
- Schedule not working

**Diagnostic Steps:**

```bash
# Check service status
curl http://localhost:3031/status

# Check logs
# In service console output

# Manual trigger
curl -X POST http://localhost:3031/check
```

**Solutions:**

```bash
# Restart service
cd mini-services/crl-scheduler
bun run dev

# Check external CRL URL
curl -I <crl-url>

# Verify CA configuration in database
```

### OCSP Responder Issues

**Symptoms:**
- OCSP requests failing
- Certificate status unknown
- Service not responding

**Solutions:**

```bash
# Test OCSP responder
curl http://localhost:3033/status

# Manual OCSP request
openssl ocsp -issuer ca.pem -cert client.pem \
  -url http://localhost:3033 -resp_text

# Check responder configuration
cat mini-services/ocsp-responder/index.ts
```

### Certificate Renewal Service Issues

**Symptoms:**
- Certificates not renewing
- Notifications not sent
- Service crashes

**Solutions:**

```bash
# Check service
curl http://localhost:3032/status

# View expiring certificates
curl http://localhost:3032/expiring

# Manual check
curl -X POST http://localhost:3032/check
```

---

## 7. Performance Issues

### Slow API Responses

**Symptoms:**
- Long loading times
- Timeout errors
- Server overload

**Diagnostic Steps:**

```bash
# Check server resources
top
free -m
df -h

# Check database size
ls -lh db/custom.db

# Profile API requests
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/users
```

**Solutions:**

```typescript
// Add database indexes
@@index([status])
@@index([createdAt])

// Use pagination
const users = await db.vpnUser.findMany({
  skip: (page - 1) * limit,
  take: limit,
});

// Optimize queries with select
const users = await db.vpnUser.findMany({
  select: { id: true, username: true }, // Only needed fields
});
```

### Memory Issues

**Symptoms:**
- Out of memory errors
- Slow garbage collection
- Process crashes

**Solutions:**

```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" bun run dev

# Check memory usage
node -e "console.log(process.memoryUsage())"

# Find memory leaks
# Use Chrome DevTools Memory Profiler
```

---

## 8. Logging & Debugging

### Enable Debug Logging

```typescript
// In API routes
console.log('[DEBUG] Request:', request.url);
console.log('[DEBUG] Body:', await request.clone().json());

// In services
console.log(`[${new Date().toISOString()}] Action:`, action);
```

### Check Application Logs

```bash
# Development logs
tail -f dev.log

# System logs
journalctl -u vpn-pki -f

# Nginx/Caddy logs
tail -f /var/log/caddy/access.log
```

### Database Query Logging

```typescript
// Enable Prisma query logging
const db = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## 9. Error Code Reference

### HTTP Status Codes
| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions, CSRF failure |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry, constraint violation |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception |
| 502 | Bad Gateway | Service unavailable |
| 503 | Service Unavailable | Service overloaded |

### Application Error Codes
| Code | Description | Solution |
|------|-------------|----------|
| AUTH001 | Invalid credentials | Check username/password |
| AUTH002 | Token expired | Re-authenticate |
| AUTH003 | 2FA required | Provide TOTP code |
| AUTH004 | Account locked | Reset password |
| CERT001 | CA not found | Create or import CA |
| CERT002 | Invalid CSR | Check CSR format |
| CERT003 | Certificate expired | Renew certificate |
| CERT004 | Already revoked | Check CRL |
| VPN001 | Service not running | Start strongSwan |
| VPN002 | Connection failed | Check network/config |
| DB001 | Database locked | Check connections |

---

## 10. Recovery Procedures

### Full System Recovery

```bash
# 1. Stop all services
systemctl stop vpn-pki
systemctl stop crl-scheduler
systemctl stop cert-renewal
systemctl stop ocsp-responder

# 2. Restore from backup
tar -xzvf backup_YYYYMMDD.tar.gz

# 3. Restore database
cp db/custom.db.backup db/custom.db

# 4. Regenerate Prisma client
bun run db:generate

# 5. Restart services
systemctl start vpn-pki
systemctl start crl-scheduler
systemctl start cert-renewal
systemctl start ocsp-responder
```

### Certificate Recovery

```bash
# If CA is lost, must recreate entire PKI
# All existing certificates become invalid

# Backup current state
cp -r /etc/swanctl /etc/swanctl.backup

# Create new CA
# Via UI: PKI > Managed PKI > Initialize Root CA

# Reissue all certificates
# Via UI or API

# Update strongSwan configuration
swanctl --load-all
```

### Database Recovery

```bash
# Check integrity
sqlite3 db/custom.db "PRAGMA integrity_check;"

# Export data
sqlite3 db/custom.db ".dump > dump.sql"

# Recreate database
rm db/custom.db
bun run db:push

# Import data
sqlite3 db/custom.db < dump.sql
```

### Reset Admin Password

```bash
# Use reset script
bun run scripts/create-admin.ts

# Or direct database update
sqlite3 db/custom.db "UPDATE AdminUser SET passwordHash='<bcrypt-hash>' WHERE username='admin';"
```

---

## Quick Diagnostic Commands

```bash
# System status
systemctl status vpn-pki strongswan

# Service health
curl http://localhost:3000/api/system/health
curl http://localhost:3031/status
curl http://localhost:3032/status
curl http://localhost:3033/status

# Database check
sqlite3 db/custom.db "SELECT COUNT(*) FROM AdminUser;"

# Certificate check
ls -la /etc/swanctl/x509/
ls -la /etc/swanctl/x509ca/

# Network check
netstat -tulpn | grep -E '3000|3031|3032|3033|500|4500'
```

---

*Last Updated: 2024*
*Version: 1.0.0*
