# PKI Configuration Guide

## Overview

This guide explains how to configure the Public Key Infrastructure (PKI) for the VPN platform. The system supports two operational modes:

1. **Managed PKI** - Full certificate lifecycle management
2. **External CA** - Integration with existing PKI infrastructure

---

## Mode Selection

### Navigate to PKI Configuration

1. Login to the web interface
2. Go to **PKI → Configuration**
3. Select your preferred mode

---

## Managed PKI Mode

### 1. Create Root Certificate Authority

**Navigate to:** PKI → CA Management → Create Root CA

**Configuration:**
| Field | Value | Description |
|-------|-------|-------------|
| Name | VPN Root CA | Friendly name |
| Common Name | VPN Root CA | Certificate subject |
| Key Size | 4096 | RSA key size |
| Validity (Years) | 20 | CA validity period |
| Country | US | ISO country code |
| State | California | State/Province |
| City | San Francisco | City |
| Organization | Company Inc | Organization name |

**Click "Create Root CA"**

### 2. Create Intermediate Certificate Authority

**Navigate to:** PKI → CA Management → Create Intermediate CA

**Configuration:**
| Field | Value | Description |
|-------|-------|-------------|
| Name | VPN Intermediate CA | Friendly name |
| Common Name | VPN Intermediate CA | Certificate subject |
| Key Size | 4096 | RSA key size |
| Validity (Years) | 10 | Intermediate CA validity |
| Parent CA | VPN Root CA | Signer CA |

**Click "Create Intermediate CA"**

### 3. Configure PKI Settings

**Navigate to:** PKI → Configuration

**Settings:**
| Setting | Recommended Value |
|---------|-------------------|
| Minimum Key Size | 4096 bits |
| Default Client Validity | 365 days |
| Default Server Validity | 730 days |
| CRL Validity | 7 days |
| Auto-reload strongSwan | Enabled |

### 4. Generate Server Certificate

**Navigate to:** Server Certificates → Create Certificate

**Configuration:**
| Field | Value |
|-------|-------|
| Hostname | vpn.example.com |
| Common Name | vpn.example.com |
| Key Size | 4096 |
| Validity (Days) | 730 |
| SAN Domains | vpn.example.com, vpn2.example.com |
| SAN IPs | 203.0.113.10 |

**Click "Generate Certificate"**

### 5. Deploy Server Certificate

1. Navigate to Server Certificates
2. Click "Deploy" on the generated certificate
3. Certificate will be copied to `/etc/swanctl/x509/`
4. Private key copied to `/etc/swanctl/private/`

### 6. Configure CRL

**Navigate to:** PKI → CRL Management

1. Click "Generate CRL" for each CA
2. Set CRL publication interval (default: 7 days)
3. Enable auto-refresh for external CRLs

---

## External CA Mode

### 1. Upload External CA Certificates

**Navigate to:** PKI → Configuration → External CA

**Steps:**
1. Select "External CA" mode
2. Upload Root CA certificate (PEM format)
3. Upload Intermediate CA certificate (optional)
4. Provide CRL URL if available

### 2. Configure CRL Fetching

**Configuration:**
| Setting | Value |
|---------|-------|
| CRL URL | http://pki.example.com/crl/ca.crl |
| Auto-fetch | Enabled |
| Fetch Interval | 24 hours |
| Fetch on Startup | Enabled |

### 3. Create Certificate Signing Requests

**Navigate to:** Certificates → Generate CSR

**For Server Certificates:**
```json
{
  "type": "server",
  "commonName": "vpn.example.com",
  "sanDomains": ["vpn.example.com"],
  "sanIPs": ["203.0.113.10"],
  "keySize": 4096,
  "organization": "Company Inc",
  "country": "US"
}
```

**For Client Certificates:**
```json
{
  "type": "client",
  "commonName": "user@example.com",
  "userId": "user-id",
  "email": "user@example.com",
  "keySize": 4096
}
```

### 4. Upload Signed Certificates

**Navigate to:** Certificates → Upload Signed

**Process:**
1. Select the CSR that was signed
2. Upload the signed certificate (PEM format)
3. Upload certificate chain (optional)
4. System will match with existing private key

---

## Certificate Management

### Client Certificates

**Generate for User:**
1. Navigate to Users
2. Find the user
3. Click "Generate Certificate"
4. Configure certificate options
5. Download PKCS#12 bundle

**Certificate Options:**
| Option | Description |
|--------|-------------|
| Validity | 90/180/365 days |
| Key Size | 2048/4096 bits |
| Include Email | Add email to SAN |
| Export Format | PEM/PKCS#12 |

### Certificate Revocation

**Revoke Certificate:**
1. Navigate to Certificates
2. Find the certificate
3. Click "Revoke"
4. Select revocation reason
5. Add notes (optional)

**Revocation Reasons:**
- UNSPECIFIED
- KEY_COMPROMISE
- CA_COMPROMISE
- AFFILIATION_CHANGED
- SUPERSEDED
- CESSATION_OF_OPERATION

### Certificate Renewal

**Automatic Renewal:**
1. Navigate to Settings → Certificate Renewal
2. Enable automatic renewal
3. Set renewal window (days before expiry)
4. Configure notification settings

**Manual Renewal:**
1. Navigate to Certificates
2. Find expiring certificate
3. Click "Renew"
4. Download new certificate

---

## CRL Management

### Generate CRL

**Navigate to:** PKI → CRL Management

1. Select CA from dropdown
2. Click "Generate CRL"
3. Review CRL content
4. Click "Publish"

### CRL Schedule

**Configure automatic CRL updates:**
```bash
# CRL Scheduler runs on port 3031
# Check status
curl http://localhost:3031/status

# Trigger manual fetch
curl -X POST http://localhost:3031/fetch/<caId>
```

---

## OCSP Configuration

### Enable OCSP Responder

**Navigate to:** PKI → OCSP Settings

1. Enable OCSP responder
2. Configure port (default: 3033)
3. Select signing CA
4. Enable/disable response signing

### OCSP URL

After enabling, the OCSP responder URL will be:
```
http://vpn.example.com:3033/
```

**Authority Information Access in certificates:**
```
OCSP - URI:http://vpn.example.com:3033/
```

---

## Best Practices

### Key Security

1. **Private Keys**
   - Store in `/etc/swanctl/private/` with 600 permissions
   - Never transmit via email
   - Use strong passwords for PKCS#12 bundles

2. **CA Protection**
   - Root CA offline when possible
   - Intermediate CA for daily operations
   - Regular backup of CA keys

3. **Certificate Validity**
   - Client certs: 1 year maximum
   - Server certs: 2 years maximum
   - CA certs: 10-20 years

### Certificate Lifecycle

```
Generation → Distribution → Active Use → Renewal → Revocation/Expiry
     ↓              ↓             ↓            ↓            ↓
   Audit Log    Email Send    Monitoring   Alerting    CRL Update
```

### Backup Strategy

1. **Daily**: Database backup
2. **Weekly**: Full PKI backup (keys, certs, database)
3. **Before Changes**: Manual backup

### Monitoring

Monitor the following:
- Certificate expiry dates (30/14/7 day alerts)
- CRL freshness
- OCSP responder health
- CA certificate validity

---

## Troubleshooting

### Certificate Issues

**Certificate not trusted:**
- Verify CA chain is complete
- Check certificate dates
- Verify certificate purpose (EKU)

**Private key mismatch:**
- Verify key belongs to certificate
- Check modulus with OpenSSL:
  ```bash
  openssl x509 -noout -modulus -in cert.pem | md5sum
  openssl rsa -noout -modulus -in key.pem | md5sum
  ```

### CRL Issues

**CRL not updating:**
- Check CRL scheduler service
- Verify CA is accessible
- Check file permissions

**CRL expired:**
- Regenerate CRL immediately
- Check auto-refresh settings

### OCSP Issues

**OCSP responder not responding:**
- Check service status
- Verify port availability
- Check certificate chain

---

## API Reference

### Generate Certificate
```bash
curl -X POST http://localhost:3000/api/certificates \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "commonName": "user@example.com",
    "keySize": 4096,
    "validityDays": 365
  }'
```

### Revoke Certificate
```bash
curl -X POST http://localhost:3000/api/certificates/{id}/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "KEY_COMPROMISE",
    "notes": "Lost device"
  }'
```

### Generate CRL
```bash
curl -X POST http://localhost:3000/api/crl \
  -H "Content-Type: application/json" \
  -d '{
    "caId": "ca-id"
  }'
```

---

*Last Updated: 2024*
