#!/bin/bash
#
# VPN PKI Management Platform - Firewall Rate Limiting Script
# 
# This script sets up nftables rules for system-wide rate limiting
# Works alongside the application-level rate limiting for defense-in-depth
#
# Usage:
#   sudo ./firewall-setup.sh install   # Install rules
#   sudo ./firewall-setup.sh remove    # Remove rules
#   sudo ./firewall-setup.sh status    # Show status
#   sudo ./firewall-setup.sh save      # Save rules permanently
#

set -e

# Configuration
TABLE_NAME="vpn_pki_filter"
APP_PORT="${APP_PORT:-3000}"
SSH_PORT="${SSH_PORT:-22}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check if nftables is available
check_nftables() {
    if ! command -v nft &> /dev/null; then
        log_error "nftables is not installed. Install with: apt install nftables"
        exit 1
    fi
}

# Install firewall rules
install_rules() {
    log_info "Installing nftables firewall rules..."
    
    # Check if table already exists
    if nft list table inet $TABLE_NAME &> /dev/null; then
        log_warn "Table $TABLE_NAME already exists. Removing old rules..."
        nft delete table inet $TABLE_NAME
    fi
    
    # Create table and chains
    nft add table inet $TABLE_NAME
    
    # Input chain with rate limiting
    nft add chain inet $TABLE_NAME input '{ type filter hook input priority 0 ; policy accept ; }'
    
    # ============================================
    # Connection Tracking (allow established)
    # ============================================
    log_info "Setting up connection tracking..."
    nft add rule inet $TABLE_NAME input ct state established,related accept
    nft add rule inet $TABLE_NAME input ct state invalid drop
    
    # ============================================
    # Loopback - Allow all
    # ============================================
    nft add rule inet $TABLE_NAME input iif lo accept
    
    # ============================================
    # ICMP - Allow ping (rate limited)
    # ============================================
    log_info "Setting up ICMP rules..."
    nft add rule inet $TABLE_NAME input ip protocol icmp icmp type echo-request limit rate 1/second accept
    nft add rule inet $TABLE_NAME input ip6 nexthdr icmpv6 icmpv6 type echo-request limit rate 1/second accept
    
    # ============================================
    # SSH - Brute force protection
    # ============================================
    log_info "Setting up SSH protection (port $SSH_PORT)..."
    # Allow 4 new SSH connections per minute per IP
    nft add set inet $TABLE_NAME ssh_meter '{ type ipv4_addr ; size 65535 ; flags dynamic ; }'
    nft add rule inet $TABLE_NAME input tcp dport $SSH_PORT ct state new \
        add @ssh_meter { ip saddr limit rate 4/minute } accept
    nft add rule inet $TABLE_NAME input tcp dport $SSH_PORT ct state new drop
    
    # ============================================
    # VPN PKI App - Rate limiting
    # ============================================
    log_info "Setting up VPN PKI app protection (port $APP_PORT)..."
    # Allow 150 new connections per minute per IP (slightly higher than app-level limit)
    nft add set inet $TABLE_NAME app_meter '{ type ipv4_addr ; size 65535 ; flags dynamic ; }'
    nft add rule inet $TABLE_NAME input tcp dport $APP_PORT ct state new \
        add @app_meter { ip saddr limit rate 150/minute } accept
    nft add rule inet $TABLE_NAME input tcp dport $APP_PORT ct state new jump rate_limit_log
    
    # ============================================
    # IPSec/IKEv2 - VPN Ports (500, 4500)
    # ============================================
    log_info "Setting up IPSec/IKEv2 protection..."
    # Allow IKE (UDP 500) and NAT-T (UDP 4500)
    nft add set inet $TABLE_NAME vpn_meter '{ type ipv4_addr ; size 65535 ; flags dynamic ; }'
    nft add rule inet $TABLE_NAME input udp dport { 500, 4500 } \
        add @vpn_meter { ip saddr limit rate 100/minute } accept
    nft add rule inet $TABLE_NAME input udp dport { 500, 4500 } jump rate_limit_log
    
    # ESP protocol for IPSec
    nft add rule inet $TABLE_NAME input ip protocol esp accept
    
    # ============================================
    # Port Scan Protection
    # ============================================
    log_info "Setting up port scan protection..."
    nft add set inet $TABLE_NAME scan_meter '{ type ipv4_addr ; size 65535 ; flags dynamic ; }'
    # If more than 10 different ports scanned in 1 minute, block
    nft add rule inet $TABLE_NAME input tcp flags syn tcp dport != { $SSH_PORT, $APP_PORT, 500, 4500 } \
        add @scan_meter { ip saddr limit rate over 10/minute } jump rate_limit_log
    
    # ============================================
    # Logging Chain
    # ============================================
    nft add chain inet $TABLE_NAME rate_limit_log
    nft add rule inet $TABLE_NAME rate_limit_log log prefix \"[NFT_RATE_LIMIT] \" drop
    
    # ============================================
    # Default Policy - Accept (we log and drop above)
    # ============================================
    
    log_success "Firewall rules installed successfully!"
    show_status
}

# Remove firewall rules
remove_rules() {
    log_info "Removing nftables firewall rules..."
    
    if nft list table inet $TABLE_NAME &> /dev/null; then
        nft delete table inet $TABLE_NAME
        log_success "Firewall rules removed successfully!"
    else
        log_warn "Table $TABLE_NAME does not exist. Nothing to remove."
    fi
}

# Show firewall status
show_status() {
    echo ""
    echo "==========================================="
    echo "       VPN PKI Firewall Status"
    echo "==========================================="
    echo ""
    
    if nft list table inet $TABLE_NAME &> /dev/null; then
        echo -e "${GREEN}● Firewall: ENABLED${NC}"
        echo ""
        echo "--- Active Rules ---"
        nft list table inet $TABLE_NAME
        echo ""
        
        # Show meter counts
        echo "--- Rate Limit Counters ---"
        echo "SSH meter entries: $(nft list set inet $TABLE_NAME ssh_meter 2>/dev/null | grep -c 'elements' || echo '0')"
        echo "App meter entries: $(nft list set inet $TABLE_NAME app_meter 2>/dev/null | grep -c 'elements' || echo '0')"
        echo "VPN meter entries: $(nft list set inet $TABLE_NAME vpn_meter 2>/dev/null | grep -c 'elements' || echo '0')"
    else
        echo -e "${RED}○ Firewall: DISABLED${NC}"
        echo ""
        echo "Run 'sudo $0 install' to enable firewall rules."
    fi
    
    echo ""
    echo "==========================================="
}

# Save rules permanently
save_rules() {
    log_info "Saving nftables rules permanently..."
    
    # Export current rules
    nft list ruleset > /etc/nftables.conf
    
    # Ensure nftables service is enabled
    systemctl enable nftables 2>/dev/null || true
    
    log_success "Rules saved to /etc/nftables.conf"
    log_info "Rules will be loaded on boot via nftables service."
}

# Show usage
show_usage() {
    echo ""
    echo "VPN PKI Firewall Management Script"
    echo ""
    echo "Usage: sudo $0 <command>"
    echo ""
    echo "Commands:"
    echo "  install    Install firewall rules"
    echo "  remove     Remove firewall rules"
    echo "  status     Show firewall status"
    echo "  save       Save rules permanently (persist across reboots)"
    echo ""
    echo "Environment Variables:"
    echo "  APP_PORT   Application port (default: 3000)"
    echo "  SSH_PORT   SSH port (default: 22)"
    echo ""
    echo "Examples:"
    echo "  sudo APP_PORT=3000 ./firewall-setup.sh install"
    echo "  sudo ./firewall-setup.sh status"
    echo ""
}

# Main
case "${1:-}" in
    install)
        check_root
        check_nftables
        install_rules
        ;;
    remove)
        check_root
        remove_rules
        ;;
    status)
        show_status
        ;;
    save)
        check_root
        save_rules
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
