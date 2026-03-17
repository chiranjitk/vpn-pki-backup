# Security Recommendations for 24online SecureGate Appliance

Here's a comprehensive security hardening guide for your network gateway appliance:

---

## 1. OPERATING SYSTEM HARDENING

### A. Kernel Security
```bash
# /etc/sysctl.d/99-securegate-hardening.conf

# Network hardening
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# TCP hardening
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5
net.ipv4.tcp_rst = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Disable IP forwarding unless needed
net.ipv4.ip_forward = 1  # Keep 1 for VPN gateway

# Memory protection
kernel.exec-shield = 1
kernel.randomize_va_space = 2

# Disable magic SysRq
kernel.sysrq = 0

# Core dumps
fs.suid_dumpable = 0
```

### B. Mandatory Access Control (MAC)
```bash
# Install and configure AppArmor or SELinux
apt install apparmor apparmor-profiles apparmor-utils

# Enable AppArmor
systemctl enable apparmor
systemctl start apparmor

# Create custom profiles for VPN services
aa-genprof /usr/sbin/charon  # strongSwan
aa-genprof /usr/sbin/openvpn
```

### C. Secure Boot & Integrity
```bash
# Enable Secure Boot in BIOS/UEFI
# Implement dm-verity for root filesystem integrity

# Install AIDE for file integrity monitoring
apt install aide
aide --init
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Daily integrity checks
echo "0 3 * * * /usr/bin/aide --check | mail -s 'AIDE Report' admin@company.com" | crontab -
```

---

## 2. NETWORK SECURITY

### A. Firewall (nftables/iptables)
```bash
# /etc/nftables.conf - Comprehensive firewall rules

table inet securegate_firewall {
    # Rate limiting for brute force protection
    set bruteforce {
        type ipv4_addr
        flags timeout
        timeout 1h
    }

    chain input {
        type filter hook input priority 0; policy drop;

        # Allow established connections
        ct state established,related accept

        # Drop invalid packets
        ct state invalid drop

        # Allow loopback
        iif lo accept

        # Rate limit ICMP
        ip protocol icmp limit rate 1/second accept
        ip6 nexthdr icmpv6 limit rate 1/second accept

        # SSH rate limiting (prevent brute force)
        tcp dport 22 ct state new limit rate 3/minute accept
        tcp dport 22 ct state new add @bruteforce { ip saddr } drop

        # VPN ports
        udp dport { 500, 4500 } accept  # IKEv2/IPsec
        udp dport 1194 accept            # OpenVPN
        tcp dport 443 accept             # HTTPS (consider port 80 redirect)

        # Management interface (restrict to specific IPs)
        ip saddr { 10.0.0.0/8, 192.168.0.0/16 } tcp dport 3000 accept

        # Drop everything else
        log prefix "[NFT-DROP] " drop
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        # Allow VPN traffic forwarding
        ct state established,related accept

        # GeoIP filtering (if implemented)
        # jump geoip_filter

        # Log and drop
        log prefix "[NFT-FWD-DROP] " drop
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

### B. DDoS Protection
```bash
# Install and configure ddos-deflate or similar
apt install ddos-deflate

# Configure /etc/ddos-deflate/ddos.conf
NO_OF_CONNECTIONS=100
BAN_PERIOD=3600
EMAIL_TO="admin@company.com"

# Synproxy for SYN flood protection (nftables)
nft add rule inet securegate_firewall input tcp dport { 80, 443 } \
    tcp flags syn tcp option maxseg size set rt mtu \
    synproxy mss 1460 wscale 7
```

### C. Port Knocking (Stealth Management Access)
```bash
# /etc/knockd.conf
[openSSH]
    sequence    = 7000,8000,9000
    seq_timeout = 5
    command     = /sbin/iptables -A INPUT -s %IP% -p tcp --dport 22 -j ACCEPT
    tcpflags    = syn

[closeSSH]
    sequence    = 9000,8000,7000
    seq_timeout = 5
    command     = /sbin/iptables -D INPUT -s %IP% -p tcp --dport 22 -j ACCEPT
    tcpflags    = syn
```

---

## 3. ACCESS CONTROL & AUTHENTICATION

### A. Multi-Factor Authentication (Already in product)
- ✅ 2FA for admin users
- ✅ Certificate-based VPN authentication

### B. SSH Hardening
```bash
# /etc/ssh/sshd_config

# Disable root login
PermitRootLogin no

# Key-based authentication only
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey

# Use Ed25519 keys (stronger than RSA)
HostKey /etc/ssh/ssh_host_ed25519_key

# Restrict users
AllowGroups ssh-users admin

# Session limits
MaxAuthTries 3
MaxSessions 5
MaxStartups 10:30:60

# Idle timeout
ClientAliveInterval 300
ClientAliveCountMax 2

# Disable unused features
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no

# Force SSH protocol 2
Protocol 2

# Port (change from default)
Port 2222
```

### C. PAM Hardening
```bash
# /etc/pam.d/common-auth
auth required pam_faillock.so preauth deny=5 unlock_time=900
auth required pam_unix.so try_first_pass nullok
auth required pam_faillock.so authfail deny=5 unlock_time=900
auth required pam_deny.so

# Password strength
password requisite pam_pwquality.so retry=3 minlen=12 difok=3 \
    ucredit=-1 lcredit=-1 dcredit=-1 ocredit=-1 \
    reject_username enforce_for_root

# Session limits
session required pam_limits.so
```

### D. Sudo Configuration
```bash
# /etc/sudoers.d/securegate

# Require password for sudo
Defaults timestamp_timeout=5
Defaults passwd_tries=3
Defaults lecture=always

# Specific command access only
%securegate-admins ALL=(ALL) /usr/bin/systemctl restart strongswan
%securegate-admins ALL=(ALL) /usr/bin/systemctl restart openvpn
%securegate-admins ALL=(ALL) /usr/local/bin/securegate-*

# Log all sudo commands
Defaults log_output, syslog=authpriv
```

---

## 4. ENCRYPTION & DATA PROTECTION

### A. Disk Encryption
```bash
# Full disk encryption with LUKS
cryptsetup luksFormat /dev/sda2
cryptsetup luksOpen /dev/sda2 securegate-root

# Add key slots for recovery
cryptsetup luksAddKey /dev/sda2 /root/luks-backup.key

# TPM-backed encryption (if TPM available)
apt install tpm2-tools
tpm2_seal_encrypt
```

### B. Secure Key Storage
```bash
# Use Hardware Security Module (HSM) or TPM
# For CA private keys, consider:
# - Nitrokey HSM
# - YubiKey
# - SoftHSM for software emulation

apt install softhsm2
softhsm2-util --init-token --slot 0 --label "SecureGate CA"
```

### C. TLS Hardening
```nginx
# /etc/nginx/ssl-hardening.conf (if using nginx reverse proxy)

ssl_protocols TLSv1.3 TLSv1.2;
ssl_prefer_server_ciphers on;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## 5. MONITORING & DETECTION

### A. Intrusion Detection System (IDS)
```bash
# Install Suricata or Snort
apt install suricata

# Enable IPS mode
# /etc/suricata/suricata.yaml
af-packet:
  - interface: eth0
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes

# Update rules
suricata-update
```

### B. File Integrity Monitoring (FIM)
```bash
# AIDE or Samhain for critical files
# Monitor: /etc/, /usr/local/, /var/lib/securegate/

# Real-time monitoring with inotify
apt install inotify-tools
inotifywait -m -r /etc -e modify,create,delete |
  while read path action file; do
    logger "FIM Alert: $path$file $action"
  done
```

### C. Security Information & Event Management (SIEM)
```bash
# Already in product ✅ - Enhance with:

# Forward logs to external SIEM
# /etc/rsyslog.d/99-forward-siem.conf
*.* @@siem.company.local:514

# JSON format for modern SIEMs
template(name="JsonFormat" type="list" option.json="on") {
    constant(value="{")
    constant(value="\"timestamp\":\"")
    property(name="timereported" dateFormat="rfc3339")
    constant(value="\",\"host\":\"")
    property(name="hostname")
    constant(value="\",\"app\":\"")
    property(name="app-name")
    constant(value="\",\"msg\":\"")
    property(name="msg" escapeJSON="on")
    constant(value="\"}\n")
}
*.* @@siem.company.local:514;JsonFormat
```

### D. Audit Daemon Enhancement
```bash
# /etc/audit/auditd.conf - Enhanced rules

# Monitor all system calls
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k sudo
-w /etc/ssh/sshd_config -p wa -k ssh

# Monitor VPN configurations
-w /etc/strongswan -p wa -k vpn_config
-w /etc/openvpn -p wa -k vpn_config

# Monitor certificates
-w /etc/ssl/private -p wa -k certificates
-w /var/lib/securegate/pki -p wa -k certificates

# Monitor application
-w /var/lib/securegate -p wa -k app_data

# System calls
-a always,exit -F arch=b64 -S execve -k exec
-a always,exit -F arch=b64 -S open,openat -F auid>=1000 -k file_access

# Login attempts
-w /var/log/auth.log -p wa -k auth_log
```

---

## 6. CONTAINER/PROCESS ISOLATION

### A. Systemd Sandboxing
```ini
# /etc/systemd/system/securegate.service.d/override.conf

[Service]
# No new privileges
NoNewPrivileges=yes

# Restrict filesystem access
ReadOnlyPaths=/etc
ReadWritePaths=/var/lib/securegate /var/log/securegate
InaccessiblePaths=/root /home

# Restrict system calls
SystemCallFilter=@system-service
SystemCallFilter=~@privileged

# Memory limits
MemoryMax=2G
MemoryHigh=1.5G

# CPU limits
CPUQuota=200%

# Network namespace (if needed)
# PrivateNetwork=yes

# User namespace
PrivateUsers=yes

# Protect system directories
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Restrict capabilities
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_BIND_SERVICE

# Security modules
SecureBits=setuid+setgid
```

---

## 7. HARDWARE SECURITY

### A. Physical Security
- [ ] BIOS/UEFI password protection
- [ ] Disable USB boot
- [ ] Disable unused ports (USB, Serial)
- [ ] TPM 2.0 activation
- [ ] Secure Boot enabled
- [ ] Chassis intrusion detection

### B. Watchdog Timer
```bash
# Hardware watchdog for automatic recovery
apt install watchdog

# /etc/watchdog.conf
watchdog-device = /dev/watchdog
interval = 10
logtick = 60
max-load-1 = 24
max-load-5 = 18
max-load-15 = 12

# Monitor critical services
pidfile = /var/run/strongswan.pid
pidfile = /var/run/securegate.pid

# Network check
interface = eth0
ping = 8.8.8.8
```

---

## 8. BACKUP & RECOVERY SECURITY

### A. Encrypted Backups
```bash
# Encrypted offsite backup
BACKUP_FILE="backup-$(date +%Y%m%d).tar.gz.gpg"
tar czf - /var/lib/securegate /etc/strongswan | \
    gpg --encrypt --recipient admin@company.com --output $BACKUP_FILE

# Send to remote storage with integrity check
rclone copy $BACKUP_FILE remote:backups/ --checksum
```

### B. Disaster Recovery
```bash
# Recovery partition with minimal system
# Automated recovery boot option (password protected)
# Recovery ISO on separate partition
```

---

## 9. NETWORK SEGMENTATION

```
                    ┌─────────────────────────────────────┐
                    │          MANAGEMENT VLAN            │
                    │     (Admin Access Only - Port 3000) │
                    └─────────────────┬───────────────────┘
                                      │
┌────────────────┐  ┌─────────────────┴─────────────────┐  ┌────────────────┐
│   UNTRUSTED    │  │          DMZ ZONE                  │  │   TRUSTED      │
│   INTERNET     │──│  ┌─────────────────────────────┐   │──│   LAN          │
│                │  │  │   SecureGate Gateway        │   │  │                │
│  (VPN Clients) │  │  │   - IKEv2/IPsec :500,4500   │   │  │  (Internal     │
│                │  │  │   - OpenVPN :1194           │   │  │   Network)     │
│                │  │  │   - HTTPS :443              │   │  │                │
└────────────────┘  │  │   - Management :3000 (mgmt) │   │  └────────────────┘
                    │  └─────────────────────────────┘   │
                    │                                     │
                    └─────────────────────────────────────┘
```

### Implementation:
```bash
# VLAN tagging
ip link add link eth0 name eth0.100 type vlan id 100  # Management
ip link add link eth0 name eth0.200 type vlan id 200  # DMZ
ip link add link eth0 name eth0.300 type vlan id 300  # Trusted

# Bridge for VPN clients
ip link add br-vpn type bridge
ip link set br-vpn up
```

---

## 10. AUTOMATED SECURITY UPDATES

### A. Unattended Upgrades
```bash
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::Package-Blacklist {
    // Add packages that should NOT be auto-updated
};

Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

### B. Live Patching
```bash
# Kernel live patching (if supported)
apt install canonical-livepatch
canonical-livepatch enable <YOUR_TOKEN>
```

---

## 11. IMPLEMENTATION PRIORITY

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| 🔴 High | Firewall hardening | Low | Critical |
| 🔴 High | SSH hardening | Low | Critical |
| 🔴 High | Kernel hardening | Low | High |
| 🔴 High | Audit logging | Medium | High |
| 🟡 Medium | AppArmor profiles | Medium | High |
| 🟡 Medium | IDS/IPS (Suricata) | Medium | High |
| 🟡 Medium | Disk encryption | Low | High |
| 🟡 Medium | File integrity (AIDE) | Low | Medium |
| 🟢 Low | Port knocking | Low | Medium |
| 🟢 Low | HSM integration | High | High |

---

## 12. QUICK START SCRIPT

```bash
#!/bin/bash
# securegate-hardening.sh - Quick security hardening

set -e

echo "🔒 Applying SecureGate security hardening..."

# 1. Apply sysctl hardening
cp configs/sysctl-hardening.conf /etc/sysctl.d/99-securegate.conf
sysctl -p /etc/sysctl.d/99-securegate.conf

# 2. Harden SSH
cp configs/sshd-hardened.conf /etc/ssh/sshd_config.d/
systemctl reload sshd

# 3. Install and configure firewall
apt install -y nftables
cp configs/nftables-securegate.conf /etc/nftables.conf
systemctl enable nftables
systemctl start nftables

# 4. Install IDS
apt install -y suricata
suricata-update

# 5. Install file integrity
apt install -y aide
aide --init
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# 6. Install audit
apt install -y auditd audispd-plugins
cp configs/audit-rules.conf /etc/audit/rules.d/securegate.rules
service auditd restart

# 7. Enable AppArmor
apt install -y apparmor apparmor-profiles
systemctl enable apparmor

echo "✅ Security hardening complete!"
echo "⚠️  Remember to:"
echo "   - Change default passwords"
echo "   - Configure SSH keys"
echo "   - Review firewall rules"
echo "   - Test all services"
```

