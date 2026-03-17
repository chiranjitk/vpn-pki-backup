# VPN Configuration Guide

## Overview

This guide covers the complete configuration of VPN services, including:
- Connection profiles with multiple authentication modes
- IP address pools
- Tunnel templates (split/full tunnel)
- Site-to-Site VPN tunnels
- Session management

---

## Connection Profiles

### Navigate to VPN Configuration

1. Login to web interface
2. Go to **VPN → Connection Profiles**

### Authentication Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| MANAGED_CERT | VPN-issued certificates | Full PKI control |
| EXTERNAL_CERT | External CA certificates | Existing PKI integration |
| EXTERNAL_CERT_RADIUS | External CA + RADIUS | Shared WiFi/VPN auth |
| EAP_RADIUS | RADIUS-only auth | Legacy authentication |
| EAP_TLS | Certificate-based EAP | High security |

### Creating a Connection Profile

**Navigate to:** VPN → Connection Profiles → Add Profile

#### Basic Settings

| Field | Value | Description |
|-------|-------|-------------|
| Profile Name | Default IKEv2 | Friendly name |
| Connection Name | ikev2-cert | strongSwan connection name |
| Description | Default profile | Optional notes |
| IKE Version | 2 | IKEv2 recommended |
| Enabled | Yes | Active profile |

#### IKE/ESP Proposals

**IKE Proposals (recommended):**
```
aes256-sha256-modp2048,aes256-sha256-modp1024
```

**ESP Proposals (recommended):**
```
aes256-sha256,aes128-sha256
```

#### IP Address Pool

| Field | Value |
|-------|-------|
| Pool Name | vpn-pool |
| Address Range | 10.70.0.0/24 |
| DNS Servers | 8.8.8.8 |
| DNS Suffixes | corp.example.com |

#### Advanced Options

| Option | Default | Description |
|--------|---------|-------------|
| MOBIKE | Enabled | Mobility and multihoming |
| Fragmentation | Enabled | IKE fragmentation |
| DPD Timeout | 30 | Dead peer detection timeout |
| DPD Action | restart | Action on peer failure |
| Start Action | none | Tunnel start behavior |

### Profile Templates

#### Template 1: Managed PKI (Full Control)

```json
{
  "name": "Corporate IKEv2",
  "connectionName": "corp-ikev2",
  "ikeVersion": 2,
  "clientAuthMode": "MANAGED_CERT",
  "ikeProposals": "aes256-sha256-modp2048",
  "espProposals": "aes256-sha256",
  "poolName": "corp-pool",
  "poolAddressRange": "10.70.0.0/24",
  "dnsServers": "10.0.0.1",
  "mobike": true,
  "dpdTimeout": 30,
  "dpdAction": "restart"
}
```

#### Template 2: External CA + RADIUS

```json
{
  "name": "External PKI + RADIUS",
  "connectionName": "external-radius",
  "ikeVersion": 2,
  "clientAuthMode": "EXTERNAL_CERT_RADIUS",
  "remoteCaId": "external-ca-id",
  "radiusConfigId": "radius-server-id",
  "identityMappingId": "email-mapping-id",
  "ikeProposals": "aes256-sha256-modp2048",
  "espProposals": "aes256-sha256"
}
```

### Applying Configuration

1. **Preview Configuration**
   - Click "Preview" on profile
   - Review generated swanctl.conf

2. **Apply Single Profile**
   - Click "Apply" on profile
   - Configuration deployed to `/etc/swanctl/conf.d/`

3. **Apply All Profiles**
   - Click "Apply All Profiles"
   - Generates combined `/etc/swanctl/swanctl.conf`

---

## IP Address Pools

### Navigate to VPN → IP Pools

### Creating an IP Pool

| Field | Value | Description |
|-------|-------|-------------|
| Name | corp-pool | Pool identifier |
| CIDR | 10.70.0.0/24 | Address range |
| Gateway | 10.70.0.1 | Optional gateway |
| DNS Servers | 10.0.0.1 | DNS for pool clients |
| Auto-Allocate | Yes | Automatic IP assignment |

### Pool Management

- **View Utilization**: Pool list shows used/available addresses
- **Manual Reservations**: Reserve specific IPs for users
- **Pool Statistics**: Monitor pool usage over time

---

## Tunnel Templates

### Navigate to VPN → Tunnel Templates

### Template Types

| Type | Description | Traffic Pattern |
|------|-------------|-----------------|
| SPLIT_TUNNEL | Corporate traffic only | Specified routes |
| FULL_TUNNEL | All traffic through VPN | 0.0.0.0/0 |
| SPLIT_EXCLUDE | Split with exclusions | Include + exclude lists |
| CUSTOM | Custom configuration | Flexible |

### Creating a Split Tunnel Template

**Navigate to:** VPN → Tunnel Templates → Add Template

| Field | Value |
|-------|-------|
| Name | Corporate Split |
| Type | SPLIT_TUNNEL |
| Included Routes | 10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 |
| DNS Servers | 10.0.0.1,10.0.0.2 |
| DNS Suffixes | corp.example.com,internal.example.com |

### Creating a Full Tunnel Template

| Field | Value |
|-------|-------|
| Name | Full Tunnel |
| Type | FULL_TUNNEL |
| Included Routes | 0.0.0.0/0 |
| Excluded Routes | 10.0.0.0/8 (local network) |
| DNS Servers | 10.0.0.1 |

### Assigning Template to Profile

1. Navigate to Connection Profiles
2. Edit profile
3. Select Tunnel Template from dropdown
4. Save and apply

---

## Site-to-Site VPN

### Navigate to VPN → Site-to-Site

### Creating a Remote Gateway

**Navigate to:** Site-to-Site → Gateways → Add Gateway

#### Gateway Configuration

| Field | Value | Description |
|-------|-------|-------------|
| Name | Branch Office NY | Friendly name |
| Peer IP | 203.0.113.50 | Remote gateway IP |
| Peer ID | @branch-ny | IKE identity (optional) |
| Auth Method | PSK or CERTIFICATE | Authentication type |
| IKE Version | 2 | Protocol version |
| Location | New York, USA | Geographic location |

#### Authentication Options

**PSK Authentication:**
| Field | Value |
|-------|-------|
| PSK | (generated or manual) |
| PSK Type | RAW, HEX, or BASE64 |

**Certificate Authentication:**
| Field | Value |
|-------|-------|
| Local Certificate | Select from dropdown |
| Remote CA | Peer's issuing CA |

#### DPD Settings

| Field | Default | Description |
|-------|---------|-------------|
| DPD Enabled | Yes | Dead peer detection |
| DPD Delay | 30 | Seconds between checks |
| DPD Timeout | 120 | Seconds before failure |
| DPD Action | restart | Action on failure |

### Creating a Site-to-Site Tunnel

**Navigate to:** Site-to-Site → Tunnels → Add Tunnel

#### Network Configuration

| Field | Value | Description |
|-------|-------|-------------|
| Name | HQ to Branch NY | Tunnel name |
| Gateway | Branch Office NY | Remote gateway |
| Local Subnets | 192.168.1.0/24 | Local networks |
| Remote Subnets | 192.168.2.0/24 | Remote networks |

#### Advanced Settings

| Field | Default | Description |
|-------|---------|-------------|
| Start Action | start | Auto-connect |
| Rekey Time | 3600 | IKE SA rekey seconds |
| Life Time | 28800 | Child SA lifetime |
| PFS Enabled | Yes | Perfect forward secrecy |
| PFS Group | modp2048 | DH group |

### Monitoring Site-to-Site Tunnels

**Navigate to:** Site-to-Site → Monitoring

**Metrics Available:**
- Tunnel status (UP/DOWN)
- Latency (milliseconds)
- Throughput (bytes/sec)
- Traffic counters
- Connection quality score

---

## VPN Sessions

### Navigate to VPN Sessions

### Session Management

**View Active Sessions:**
- Username
- Source IP
- Virtual IP
- Connected time
- Bytes in/out
- Authentication method

**Session Actions:**
- Disconnect user
- View certificate details
- Blacklist user

### Session Statistics

**Navigate to:** VPN Sessions → Statistics

- Total active sessions
- Unique users
- Peak connections
- Traffic statistics
- Session duration distribution

---

## Identity Mappings (External CA)

### Navigate to VPN → Identity Mappings

### Purpose

Extract user identity from external CA certificates for RADIUS authorization.

### Creating an Identity Mapping

| Field | Value | Description |
|-------|-------|-------------|
| Name | Email from SAN | Mapping name |
| Source Field | SAN_EMAIL | Certificate field |
| Extract Pattern | (regex optional) | Extraction pattern |

**Available Source Fields:**
| Field | Description |
|-------|-------------|
| CN | Subject Common Name |
| SAN_EMAIL | SubjectAltName email |
| SAN_UPN | SubjectAltName UPN |
| SAN_DNS | SubjectAltName DNS name |

### Example Mappings

**Extract Email from SAN:**
```json
{
  "name": "Email Extraction",
  "sourceField": "SAN_EMAIL",
  "description": "Use email from certificate SAN"
}
```

**Extract Username from CN:**
```json
{
  "name": "CN Username",
  "sourceField": "CN",
  "extractPattern": "^(.+)@",
  "description": "Extract username before @ symbol"
}
```

---

## Client Configuration

### Download Client Configuration

**Navigate to:** Connection Profiles → Download Config

**Supported Platforms:**
- Windows (native IKEv2)
- macOS (native IKEv2)
- iOS (native IKEv2)
- Android (strongSwan app)
- Linux (NetworkManager)

### Certificate Delivery

**Options:**
1. **Email Delivery**
   - Navigate to User → Certificate → Send Email
   - PKCS#12 bundle with password

2. **Download**
   - PEM format (separate cert + key)
   - PKCS#12 format (bundled)

---

## StrongSwan Integration

### File Locations

| File/Directory | Purpose |
|----------------|---------|
| /etc/swanctl/swanctl.conf | Main configuration |
| /etc/swanctl/conf.d/*.conf | Profile configurations |
| /etc/swanctl/x509/ | Server/client certificates |
| /etc/swanctl/x509ca/ | CA certificates |
| /etc/swanctl/private/ | Private keys |
| /etc/swanctl/x509crl/ | CRL files |

### Service Management

```bash
# Reload configuration
sudo swanctl --load-all

# List connections
sudo swanctl --list-conns

# List active SAs
sudo swanctl --list-sas

# Initiate connection
sudo swanctl --initiate --child <name>

# Terminate connection
sudo swanctl --terminate --ike <name>
```

---

## Troubleshooting

### Common Issues

**Client cannot connect:**
1. Verify server certificate is valid
2. Check firewall allows UDP 500/4500
3. Verify client certificate is not revoked
4. Check CRL is up to date

**Authentication failures:**
1. Verify certificate chain
2. Check CA is trusted
3. Verify identity mapping (external CA)
4. Check RADIUS server connectivity

**No traffic through tunnel:**
1. Check traffic selectors
2. Verify routing table
3. Check firewall rules
4. Verify DNS settings

### Debug Commands

```bash
# View strongSwan logs
journalctl -u strongswan -f

# Check certificate
openssl x509 -in /etc/swanctl/x509/vpn-server.pem -text -noout

# Test CRL
openssl crl -in /etc/swanctl/x509crl/ca.crl -text -noout

# Check SA status
swanctl --list-sas
```

---

## Best Practices

### Security

1. Use IKEv2 exclusively
2. Strong encryption (AES-256, SHA-256)
3. Enable MOBIKE for mobile clients
4. Regular certificate rotation
5. Monitor CRL freshness

### Performance

1. Appropriate IP pool sizing
2. Multiple connection profiles for different use cases
3. Use DPD for stale connection cleanup
4. Monitor tunnel health

### Operations

1. Regular backup of configurations
2. Monitor certificate expiry
3. Audit user access
4. Document all changes

---

*Last Updated: 2024*
