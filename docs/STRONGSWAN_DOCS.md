# strongSwan 6.0 Documentation Reference

> Source: https://docs.strongswan.org/docs/latest/index.html
> Retrieved: March 2025

## Directory Structure

The swanctl configuration directory (usually `/etc/swanctl`) contains:

| Directory | Contents |
|-----------|----------|
| `conf.d` | Config snippets included via `include conf.d/*.conf` in default swanctl.conf |
| `x509` | Trusted X.509 end entity certificates |
| `x509ca` | **Trusted X.509 Certificate Authority certificates** |
| `x509aa` | Trusted X.509 Attribute Authority certificates |
| `x509ocsp` | Trusted X.509 OCSP signer certificates |
| `x509crl` | Certificate Revocation Lists |
| `x509ac` | Attribute Certificates |
| `rsa` | PKCS#1 encoded RSA private keys |
| `ecdsa` | Plain ECDSA private keys |
| `pkcs8` | PKCS#8 encoded private keys of any type |
| `pkcs12` | PKCS#12 containers |
| `private` | Private keys in any format |
| `pubkey` | Raw public keys |

**All files may be either DER or PEM encoded.**

### Critical for IKEv2 EAP-TLS:
- **CA certificates MUST go in `x509ca/`** - This is where strongSwan looks for trusted CAs
- **Server/end-entity certificates go in `x509/`**
- **Private keys go in `private/` or type-specific directories**
- **CRL files go in `x509crl/`**

---

## swanctl.conf Configuration

### Connection Structure

```conf
connections {
    <conn_name> {
        version = 2                    # IKEv2
        local_addrs = <ip_or_hostname> # Server addresses
        remote_addrs = %any            # Accept from any

        proposals = <ike_proposals>    # IKE proposals

        local {
            auth = pubkey              # Server uses certificate
            certs = <cert_file>        # Server certificate filename
            id = @<server_id>          # Server identity
        }

        remote {
            auth = pubkey              # Client uses certificate (EAP-TLS: eap-tls)
            cacerts = <ca_cert>        # CA certificate for client verification
            id = %any                  # Accept any client identity
        }

        children {
            <child_name> {
                local_ts = 0.0.0.0/0   # Local traffic selector
                remote_ts = dynamic    # Remote traffic selector
                esp_proposals = <esp>  # ESP proposals
                mode = tunnel
                start_action = none
                dpd_action = restart
            }
        }

        pools = <pool_name>
    }
}

pools {
    <pool_name> {
        addrs = <ip_range>            # Virtual IP pool
        dns = <dns_servers>           # DNS servers
    }
}

secrets {
    private-<name> {
        file = <key_file>             # Server private key
    }
}
```

### Key Configuration Options

#### connections.<conn>.local (Server Side)
| Key | Default | Description |
|-----|---------|-------------|
| `auth` | - | Authentication method: `pubkey`, `psk`, `eap`, etc. |
| `certs` | - | Certificate filename (relative to x509/ or absolute path) |
| `id` | - | IKE identity (e.g., `@vpn.server`) |

#### connections.<conn>.remote (Client Side)
| Key | Default | Description |
|-----|---------|-------------|
| `auth` | - | Required auth method: `pubkey`, `eap-tls`, `eap`, etc. |
| `cacerts` | - | CA certificate(s) for client verification (from x509ca/) |
| `id` | %any | Client identity constraint |

#### Authentication Methods
- `pubkey` - Certificate-based authentication
- `eap-tls` - EAP-TLS authentication (requires eap-tls plugin)
- `eap` - EAP authentication (any method)
- `psk` - Pre-shared key

---

## Certificate Generation

### Generate CA Certificate

```bash
# Generate CA private key
pki --gen --type rsa --size 4096 --outform pem > caKey.pem

# Generate self-signed CA certificate (10 years)
pki --self --ca --lifetime 3652 --in caKey.pem \
    --dn "C=IN, O=24online, CN=24online VPN Root CA" \
    --outform pem > caCert.pem

# Verify CA certificate
pki --print --in caCert.pem
```

**Store CA certificate in**: `/etc/swanctl/x509ca/`

### Generate Server Certificate

```bash
# Generate server private key
pki --gen --type rsa --size 4096 --outform pem > serverKey.pem

# Create certificate request
pki --req --type priv --in serverKey.pem \
    --dn "C=IN, O=24online, CN=vpn.example.com" \
    --san vpn.example.com \
    --san 192.168.1.1 \
    --outform pem > serverReq.pem

# Issue signed certificate (5 years, with serverAuth EKU)
pki --issue --cacert caCert.pem --cakey caKey.pem \
    --type pkcs10 --in serverReq.pem \
    --serial 01 --lifetime 1826 \
    --flag serverAuth \
    --outform pem > serverCert.pem
```

**Store server certificate in**: `/etc/swanctl/x509/`
**Store server key in**: `/etc/swanctl/private/`

### Generate Client Certificate

```bash
# Generate client private key
pki --gen --type rsa --size 4096 --outform pem > clientKey.pem

# Create certificate request
pki --req --type priv --in clientKey.pem \
    --dn "C=IN, O=24online, CN=username" \
    --san username@example.com \
    --outform pem > clientReq.pem

# Issue signed certificate
pki --issue --cacert caCert.pem --cakey caKey.pem \
    --type pkcs10 --in clientReq.pem \
    --serial 02 --lifetime 365 \
    --outform pem > clientCert.pem

# Create PKCS#12 bundle for import
pki --pkcs12 --in clientCert.pem --key clientKey.pem \
    --cacert caCert.pem \
    --password "export_password" \
    --outform pem > client.p12
```

---

## CRL (Certificate Revocation List)

### Generate CRL

```bash
# Generate CRL
pki --signcrl --cacert caCert.pem --cakey caKey.pem \
    --lifetime 7 --outform pem > ca.crl
```

**Store CRL in**: `/etc/swanctl/x509crl/`

### Revoke Certificate

```bash
# Add certificate to revocation list
pki --signcrl --cacert caCert.pem --cakey caKey.pem \
    --lifetime 7 \
    --reason keyCompromise \
    --cert revokedCert.pem \
    --outform pem > ca.crl
```

---

## EAP-TLS Configuration

EAP-TLS uses TLS handshake for mutual authentication based on X.509 certificates.

### Server Configuration

```conf
connections {
    ikev2-eap-tls {
        version = 2

        local {
            auth = pubkey
            certs = serverCert.pem
            id = @vpn.server
        }

        remote {
            auth = eap-tls           # Use EAP-TLS
            cacerts = ca.pem         # CA for client verification
            id = %any
        }

        # ... rest of config
    }
}
```

### Client Configuration (for strongSwan client)

```conf
connections {
    ikev2-eap-tls {
        version = 2

        local {
            auth = eap               # Client uses EAP
            certs = clientCert.pem
            id = client@example.com
        }

        remote {
            auth = pubkey
            id = @vpn.server
        }

        # ... rest of config
    }
}
```

---

## IKE Proposals

### Modern Recommendations (IKEv2)

```
# Recommended proposals for modern clients
ike_proposals = aes256-sha256-modp2048,aes256-sha256-x25519
esp_proposals = aes256-sha256-modp2048,aes256gcm16-x25519
```

---

## Common Issues & Solutions

### Issue: "no issuer certificate found"
**Cause**: CA certificate not in `x509ca/` directory
**Solution**: Copy CA certificate to `/etc/swanctl/x509ca/`

### Issue: "certificate status is not available"
**Cause**: No CRL available
**Solution**: Generate and deploy CRL to `/etc/swanctl/x509crl/`

### Issue: "file coded in unknown format"
**Cause**: Certificate file corrupted or wrong format
**Solution**: Validate with `openssl x509 -in cert.pem -text -noout`

### Issue: "signature validation failed"
**Cause**: Certificate not signed by CA, or CA not trusted
**Solution**: Verify certificate chain with `openssl verify -CAfile ca.pem cert.pem`

---

## Useful Commands

```bash
# List loaded certificates
swanctl --list-certs

# List loaded CAs
swanctl --list-certs --type x509ca

# List connections
swanctl --list-conns

# List active SAs
swanctl --list-sas

# Reload configuration
swanctl --load-all

# Initiate connection
swanctl --initiate --ike <conn_name>

# Terminate connection
swanctl --terminate --ike <conn_name>

# Check strongSwan version
swanctl --version

# Verify certificate
pki --verify --in cert.pem --cacert caCert.pem

# Print certificate info
pki --print --in cert.pem
```

---

## strongswan.conf Options

```conf
charon {
    # CRL checking mode: strict, ifpossible, never
    crl_check = ifpossible

    # Cache CRLs in memory
    cache_crl = yes

    # Load modular plugins
    load_modular = yes

    plugins {
        # EAP-TLS plugin (required for EAP-TLS)
        eap-tls {
            load = yes
        }
    }
}
```

---

## Windows Client Requirements

1. Server certificate must have:
   - `serverAuth` EKU (Extended Key Usage)
   - Subject Alternative Name (SAN) with server hostname/IP

2. Client certificate must have:
   - `clientAuth` EKU
   - `smartcardLogon` EKU (for smartcard use)

3. Certificate chain must be complete
4. Root CA must be in Trusted Root Certification Authorities

---

## iOS/macOS Client Requirements

1. Server certificate must have:
   - `serverAuth` EKU
   - SAN with server hostname

2. Use Apple Configurator or .mobileconfig profile
3. PKCS#12 format for client certificates

---

## Notes

- strongSwan 6.0 uses the modern VICI interface (swanctl)
- Legacy stroke interface (ipsec command) is deprecated
- CA certificates in `x509ca/` are automatically trusted
- All certificates should use SAN (Subject Alternative Name)
- Use MOBIKE for mobile clients (`mobike = yes`)
- Enable fragmentation for NAT traversal (`fragmentation = yes`)
