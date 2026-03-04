Let me update the sidebar navigation to match the new design and fix the mentioned pages:
Now let me create the proper Monitoring dashboard:
Now let me enhance the Network Interfaces page with IP configuration capability:
Now let me create the VPN Session History and other missing pages:
I've completed all the requested changes. Here's a summary:

## ✅ Completed Updates

### 1. Sidebar Navigation Updated
The sidebar now matches the design structure you specified:
- **Dashboard** (/)
- **Users** → VPN Users, Admin Users
- **Certificates** → Client, Server, CA Management
- **PKI** → CA Configuration, CRL, OCSP
- **VPN** → Connection Profiles, IP Pools, Active Sessions, Session History
- **Network** → Interfaces, Routing, Diagnostics  
- **Security** → Firewall, NAT, Access Control, Deployment Mode
- **Monitoring** → Dashboard, Traffic Graphs, Logs
- **Audit** → Audit Logs
- **Settings**

### 2. Monitoring Dashboard Enhanced
- Real-time CPU, Memory, Disk, Uptime metrics
- Traffic graphs using Recharts (bandwidth monitoring)
- VPN statistics with throughput display
- System alerts section
- **New Traffic Graphs page**: `/monitoring/traffic`
- **New Logs page**: `/monitoring/logs`

### 3. Network Interfaces Page Enhanced
Now supports full IP configuration:
- **Detected Interfaces** - Shows all physical/virtual interfaces from the OS
- **Configuration Options**:
  - WAN/LAN/VPN/Management type selection
  - DHCP / Static IP / PPPoE configuration
  - IP Address, Subnet Mask, Gateway settings
  - DNS servers configuration
  - MTU settings
  - Default Gateway toggle
  - Enable/Disable interface
- **Apply Configuration** - Pushes settings to the system

### 4. New Pages Created
| Route | Description |
|-------|-------------|
| `/vpn/history` | VPN Session History with CSV export |
| `/monitoring/traffic` | Dedicated Traffic Graphs page |
| `/monitoring/logs` | System Logs viewer with filtering |
| `/network/interfaces` | Enhanced Interface management |
| `/network/routing` | Static Routes configuration |
| `/network/diagnostics` | Ping/Traceroute/DNS tools |
| `/security/firewall` | Firewall Rules management |
| `/security/nat` | NAT Policies configuration |
| `/security/access` | Access Control policies |
| `/security/deployment` | Deployment Mode toggle |

### 5. All Pages Have Proper Layout
Every page now includes:
- ✅ Header with navigation
- ✅ Sidebar navigation
- ✅ Footer
 /network/interfaces  should able to cange the intergface ip and check the design \
┌── Dashboard (/)
│
├── Users (/users)
│   ├── VPN Users
│   └── Admin Users
│
├── Certificates (/certificates)
│   ├── Client Certificates
│   ├── Server Certificates
│   └── CA Management
│
├── PKI (/pki)
│   ├── CA Configuration
│   ├── CRL Management
│   └── OCSP Settings
│
├── VPN (/vpn) ⭐ NEW
│   ├── Connection Profiles
│   ├── IP Pools
│   ├── Active Sessions
│   └── Session History
│
├── Network (/network) ⭐ NEW
│   ├── Interfaces
│   ├── Routing
│   └── Diagnostics
│
├── Security (/security) ⭐ NEW
│   ├── Firewall Rules
│   ├── NAT Policies
│   ├── Access Control
│   └── Deployment Mode
│
├── Monitoring (/monitoring)
│   ├── Dashboard (existing)
│   ├── Traffic Graphs
│   └── Logs
│
├── Audit (/audit)
│   └── Audit Logs
│
└── Settings (/settings)
    ├── VPN Config
    ├── 2FA & OCSP
    ├── RADIUS/LDAP
    ├── Geo/IP
    ├── Guests
    ├── Sessions
    ├── SIEM
    ├── SMTP
    ├── Rate Limit
    └── Firewall"  ├── IP Pools
│   ├── Pool Name
│   ├── CIDR Range (e.g., 10.70.1.0/24)
│   ├── Gateway IP
│   ├── DNS Servers (pushed to clients)
│   └── Status (Active/Disabled)
│
├── Pool Assignment
│   ├── Assign pools to connection profiles
│   └── Per-user static IP assignment
│
└── Statistics
    ├── Used IPs
    ├── Available IPs
    └── Active leases   
	
----------------------Interface Management

* WAN: DHCP / Static / PPPoE
* LAN: Static
* Multiple interfaces support
* Default gateway selection
* DNS configuration



