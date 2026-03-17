# Site-to-Site VPN Configuration Guide

## Overview

Site-to-Site VPN enables secure network-to-network connectivity between multiple locations. This guide covers:
- Remote gateway configuration
- Tunnel establishment
- Network routing
- Monitoring and troubleshooting

---

## Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│   Headquarters       │         │   Branch Office      │
│   192.168.1.0/24    │         │   192.168.2.0/24    │
│                      │         │                      │
│   ┌──────────────┐   │         │   ┌──────────────┐   │
│   │   Gateway    │◄──┼─────────┼──►│   Gateway    │   │
│   │ 203.0.113.1 │   │  IPsec  │   │ 203.0.113.50│   │
│   └──────────────┘   │  Tunnel │   └──────────────┘   │
│                      │         │                      │
└──────────────────────┘         └──────────────────────┘
```

---

## Configuration Steps

### Step 1: Create Remote Gateway

**Navigate to:** VPN → Site-to-Site → Gateways → Add Gateway

#### Basic Configuration

| Field | Example Value | Description |
|-------|---------------|-------------|
| Name | Branch-Office-NY | Gateway identifier |
| Description | NYC Branch Office | Optional notes |
| Peer IP | 203.0.113.50 | Remote gateway public IP |
| Peer ID | @branch-ny-gw | IKE identity (optional) |
| Peer Hostname | vpn.branch.com | Dynamic DNS hostname |

#### Authentication Configuration

**Option A: Pre-Shared Key (PSK)**
| Field | Value |
|-------|-------|
| Auth Method | PSK |
| PSK | (click Generate) |
| PSK Type | RAW |

**Option B: Certificate**
| Field | Value |
|-------|-------|
| Auth Method | CERTIFICATE |
| Local Certificate | Select from dropdown |
| Remote CA | Upload peer's CA |
| Remote Cert Fingerprint | Optional verification |

#### IKE/ESP Configuration

| Field | Recommended Value |
|-------|-------------------|
| IKE Version | 2 |
| IKE Proposals | aes256-sha256-modp2048 |
| ESP Proposals | aes256-sha256 |

#### DPD Settings

| Field | Value | Description |
|-------|-------|-------------|
| DPD Enabled | Yes | Detect dead peers |
| DPD Delay | 30 | Seconds between probes |
| DPD Timeout | 120 | Seconds before declaring down |
| DPD Action | restart | Action on failure |

#### NAT Traversal

| Field | Value |
|-------|-------|
| NAT Traversal | Enabled |
| Force NAT-T | No |

**Note:** Enable NAT Traversal if either gateway is behind NAT. Force NAT-T encapsulates all traffic in UDP.

#### Metadata

| Field | Description |
|-------|-------------|
| Location | Geographic location |
| Site Name | Site identifier |
| Contact Name | Technical contact |
| Contact Email | Contact email |

---

### Step 2: Create Site-to-Site Tunnel

**Navigate to:** VPN → Site-to-Site → Tunnels → Add Tunnel

#### Basic Configuration

| Field | Value | Description |
|-------|-------|-------------|
| Name | HQ-to-Branch-NY | Tunnel identifier |
| Description | Main office link | Optional notes |
| Gateway | Branch-Office-NY | Select remote gateway |
| Connection Name | s2s-hq-branch | Internal connection name |

#### Network Configuration

| Field | Value | Description |
|-------|-------|-------------|
| Local Subnets | 192.168.1.0/24 | Local networks (comma-separated) |
| Remote Subnets | 192.168.2.0/24 | Remote networks (comma-separated) |

**Multiple Subnets:**
```
Local: 192.168.1.0/24,10.0.0.0/16,172.16.0.0/12
Remote: 192.168.2.0/24,10.1.0.0/16
```

#### Traffic Selectors (Advanced)

Override default subnets with custom selectors:

| Field | Example |
|-------|---------|
| Local Traffic Selector | 192.168.1.0/24[tcp/80,tcp/443] |
| Remote Traffic Selector | 192.168.2.0/24 |

#### Security Settings

| Field | Default | Description |
|-------|---------|-------------|
| Tunnel Mode | TUNNEL | Transport or Tunnel |
| PFS Enabled | Yes | Perfect Forward Secrecy |
| PFS Group | modp2048 | DH group for PFS |

#### Lifetime Settings

| Field | Default | Description |
|-------|---------|-------------|
| Rekey Time | 3600 | IKE SA rekey (seconds) |
| Reauth Time | 0 | IKE SA reauth (0 = disabled) |
| Life Time | 28800 | Child SA lifetime (seconds) |

#### Tunnel Behavior

| Field | Options | Description |
|-------|---------|-------------|
| Start Action | none/start/trap | Connection initiation |
| Close Action | none/clear/hold | Action on disconnect |
| MOBIKE | Yes/No | Mobility support |

**Start Action Options:**
- `none` - Manual start only
- `start` - Auto-start on load
- `trap` - Start on traffic (on-demand)

---

### Step 3: Apply Configuration

1. Click **Save** on tunnel configuration
2. Navigate to tunnel list
3. Click **Apply Config** on the tunnel

**This will:**
- Generate swanctl.conf
- Write to `/etc/swanctl/conf.d/s2s-*.conf`
- Reload strongSwan

---

### Step 4: Verify Connection

**Navigate to:** VPN → Site-to-Site → Monitoring

Check for:
- **Status:** UP
- **IKE SA State:** ESTABLISHED
- **Child SA State:** INSTALLED
- **Latency:** Low value (<100ms typically)

**Manual Verification:**
```bash
# Check SA status
swanctl --list-sas

# Example output
s2s-hq-branch: #1, ESTABLISHED, IKEv2, ...
  local: 203.0.113.1
  remote: 203.0.113.50
```

---

## Advanced Configuration

### Multiple Tunnels per Gateway

For redundancy or multiple network segments:

**Tunnel 1: Primary**
```
Local: 192.168.1.0/24
Remote: 192.168.2.0/24
```

**Tunnel 2: Secondary**
```
Local: 10.0.0.0/16
Remote: 10.1.0.0/16
```

### Dynamic IP Gateway

Configure peer by hostname instead of IP:

| Field | Value |
|-------|-------|
| Peer IP | (leave empty or 0.0.0.0) |
| Peer Hostname | vpn.branch.example.com |
| Peer ID | @branch-ny-gw |

**Note:** Use DDNS service for dynamic IP endpoints.

### Route-Based VPN

For complex routing requirements:

1. Create VTI interfaces
2. Configure tunnel with `TUNNEL` mode
3. Add routes via VTI interface

```bash
# Example VTI setup
ip tunnel add vti0 mode vti local 203.0.113.1 remote 203.0.113.50 key 42
ip link set vti0 up
ip addr add 10.255.255.1/30 dev vti0
ip route add 192.168.2.0/24 dev vti0
```

---

## Monitoring

### Real-Time Metrics

**Navigate to:** Site-to-Site → Monitoring

| Metric | Description |
|--------|-------------|
| Status | UP/DOWN/INITIALIZING |
| Latency | Round-trip time (ms) |
| Throughput In | Bytes per second inbound |
| Throughput Out | Bytes per second outbound |
| Connection Score | 0-100 quality rating |
| Packet Loss | Percentage of lost packets |

### Historical Data

**Navigate to:** Monitoring → Historical Metrics

View:
- Hourly aggregated data (30 days)
- Daily aggregated data (1 year)
- Uptime percentage
- Average latency trends

### Alerts

**Configure alerts for:**
- Tunnel down
- High latency threshold
- Packet loss threshold
- Certificate expiry (if using certificates)

---

## Troubleshooting

### Tunnel Won't Establish

**Check 1: Connectivity**
```bash
# Ping remote gateway
ping 203.0.113.50

# Check IKE port
nc -zuv 203.0.113.50 500
```

**Check 2: Firewall**
```bash
# Verify UDP ports open
sudo iptables -L -n | grep -E "500|4500"
```

**Check 3: PSK Mismatch**
- Compare PSK on both gateways
- Check PSK type (RAW vs HEX)

**Check 4: Certificate Issues**
- Verify certificate chain
- Check certificate dates
- Verify CRL is accessible

### No Traffic Flow

**Check 1: Routing**
```bash
# View routes
ip route show table all

# Test connectivity
ping -I 192.168.1.1 192.168.2.1
```

**Check 2: Traffic Selectors**
- Verify local/remote subnets match on both sides
- Check for overlap or conflicts

**Check 3: Firewall**
- Ensure firewall allows tunneled traffic
- Check NAT rules don't interfere

### Intermittent Connectivity

**Check 1: DPD Settings**
- Ensure DPD is enabled
- Verify timeout values match on both sides

**Check 2: Rekey Timing**
- Check if issues occur during rekey
- Adjust rekey time if needed

**Check 3: MTU Issues**
```bash
# Test MTU
ping -s 1400 -M do 192.168.2.1

# If fails, reduce MTU
ip link set vti0 mtu 1400
```

---

## Best Practices

### Security

1. **Use Certificates for Production**
   - Stronger authentication than PSK
   - Supports certificate revocation
   - Better audit trail

2. **Enable PFS**
   - Perfect Forward Secrecy
   - Protects past traffic if key compromised

3. **Strong Encryption**
   - AES-256 for encryption
   - SHA-256 or better for integrity
   - Modp2048 or stronger for DH

4. **Regular Key Rotation**
   - Rekey hourly (default)
   - Reauth daily for certificate auth

### Reliability

1. **Configure DPD**
   - Detect dead peers quickly
   - Automatic reconnection

2. **Use Start Action**
   - `start` for always-on tunnels
   - `trap` for on-demand tunnels

3. **Monitor Actively**
   - Set up alerts
   - Regular health checks

### Performance

1. **Appropriate MTU**
   - 1400 bytes for tunnels
   - Avoid fragmentation

2. **Traffic Shaping**
   - QoS policies
   - Bandwidth limits

3. **Hardware Acceleration**
   - Use AES-NI capable CPUs
   - Offload encryption if available

---

## Configuration Examples

### Example 1: Simple Branch Connection

**Gateway:**
```json
{
  "name": "Branch-NY",
  "peerIp": "203.0.113.50",
  "authMethod": "PSK",
  "psk": "shared-secret-123",
  "ikeVersion": 2,
  "ikeProposals": "aes256-sha256-modp2048",
  "espProposals": "aes256-sha256"
}
```

**Tunnel:**
```json
{
  "name": "HQ-to-Branch",
  "gatewayId": "branch-ny-id",
  "localSubnets": "192.168.1.0/24",
  "remoteSubnets": "192.168.2.0/24",
  "startAction": "start",
  "pfsEnabled": true
}
```

### Example 2: Multi-Site Mesh

**Three Sites:**
- HQ: 192.168.1.0/24, Gateway: 203.0.113.1
- Branch NY: 192.168.2.0/24, Gateway: 203.0.113.50
- Branch LA: 192.168.3.0/24, Gateway: 203.0.113.100

**Tunnels Required:**
- HQ ↔ NY
- HQ ↔ LA
- NY ↔ LA (optional full mesh)

### Example 3: Certificate-Based Connection

**Gateway:**
```json
{
  "name": "Partner-Org",
  "peerIp": "198.51.100.10",
  "authMethod": "CERTIFICATE",
  "localCertId": "vpn-server-cert-id",
  "remoteCaId": "partner-ca-id",
  "ikeVersion": 2
}
```

---

## CLI Reference

### swanctl Commands

```bash
# List connections
swanctl --list-conns

# List active SAs
swanctl --list-sas

# Initiate tunnel
swanctl --initiate --child s2s-hq-branch

# Terminate tunnel
swanctl --terminate --ike s2s-hq-branch

# Reload configuration
swanctl --load-all

# Unload connection
swanctl --unload --name s2s-hq-branch
```

### ip Commands

```bash
# Show XFRM policies
ip xfrm policy

# Show XFRM states
ip xfrm state

# Show tunnel interfaces
ip link show type vti
```

---

*Last Updated: 2024*
