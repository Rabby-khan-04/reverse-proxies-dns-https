# docs/05a-tls-https.md

## 1. Simple explanation (like I'm 7)

**TLS (Transport Layer Security)** is the lock that protects your internet connection. When you see `https://` instead of `http://`, TLS is what makes the connection secure.

### The story of the lock:

1. **You ask for the website**: "I want `https://app1.localhost/`"
2. **The server says**: "Here's my ID card (certificate) to prove I'm really the server you want."
3. **Your computer checks the ID**: "Is this ID signed by someone I trust? Yes! Okay, let's talk."
4. **We agree on a secret code**: We do a tricky math dance to create a secret that only we two know.
5. **Everything we say is encrypted**: Now no one can eavesdrop on our conversation, not even on public WiFi.

**HTTP** is what you say. **TLS** is the locked box that protects what you say.

### HTTPS = HTTP + TLS

When you see `https://`, it means:
- **HTTP**: The web language (requests, responses, pages)
- **TLS**: The encryption layer protecting everything

---

## 2. Real name

**TLS (Transport Layer Security)** is the standard protocol that provides:
- **Encryption**: Scrambles data so eavesdroppers can't read it
- **Authentication**: Proves the server is who it claims to be
- **Integrity**: Detects if data was tampered with in transit

**Certificate Authority (CA)** is the trusted organization that issues ID cards (certificates). Your computer comes with a built-in list of trusted CAs (DigiCert, Let's Encrypt, etc.).

**Certificate** is the server's ID card. It contains:
- The server's domain name (e.g., `app1.localhost`)
- The server's public key
- The CA's signature (proves the CA verified this domain)
- Expiration date
- Serial number

**Chain of trust** is the hierarchy of trust:
```
Root CA (built into your computer)
    ↓ signs
Intermediate CA (intermediate level)
    ↓ signs
Server certificate (for app1.localhost)
```

**Handshake** is the process where client and server:
1. Agree on TLS version and cipher suite
2. Exchange certificates
3. Create shared secrets for encryption
4. Verify each other's identity

**SNI (Server Name Indication)** is an extension of the TLS handshake that tells the server which domain you're trying to connect to. This is essential for serving multiple HTTPS websites on one IP address!

**HSTS (HTTP Strict Transport Security)** is a policy that tells the browser: "Always use HTTPS for this domain, never HTTP, even if someone types `http://`." It's stored in the browser and prevents downgrade attacks.

**Key terms summary**:

| Term | What it is |
|------|------------|
| **TLS** | The encryption protocol |
| **Certificate** | Server's ID card, signed by a CA |
| **CA** | Certificate Authority that issues ID cards |
| **Chain of trust** | Hierarchy: Root CA → Intermediate CA → Server cert |
| **Handshake** | The "hello" process that sets up encryption |
| **SNI** | Tells server which domain you want (for virtual hosting) |
| **HSTS** | Browser policy: "always HTTPS, never HTTP" |

---

## 3. Config example

### Caddyfile with automatic HTTPS (your current setup)

Your Caddyfile already uses local TLS:

```caddyfile
app1.localhost {
  # Use local certificates instead of Let's Encrypt
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Reverse proxy to the Node.js app
  reverse_proxy app:3000
  
  # Security headers (includes HSTS implicitly via Caddy)
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-origin-only"
  }
}
```

### What the `tls` directive does:

- **Provides the server certificate** for TLS handshake
- **Enables HTTPS** on the domain
- **Caddy automatically manages** certificates (but we're using local ones here)
- **Port 443** is implicitly used for TLS

### Nginx server block with SSL (for comparison)

```nginx
server {
    listen 443 ssl;
    server_name app1.localhost;
    
    # SSL certificates - using local CA
    ssl_certificate /etc/nginx/certs/server-cert.pem;
    ssl_certificate_key /etc/nginx/certs/server-key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Optional: HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Reverse proxy
    location / {
        proxy_pass http://app:3000;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Testing TLS with openssl s_client

```bash
# Test the TLS connection
openssl s_client -connect app1.localhost:443 -servername app1.localhost

; Expected output (relevant parts):
CONNECTED(00000003)
depth=2 CN=localhost-CA
verify: OK
returned: OK
verify return: OK
---
DSA-SHA256 public key
...
---
Certificate chain
 0 s:/CN=localhost
   i:/CN=localhost-CA
 1 s:/CN=localhost-CA
   i:/CN=localhost-CA
...
---
Server certificate
-----BEGIN CERTIFICATE-----
MIICyTCCAa.... (the actual cert in Base64)
-----END CERTIFICATE-----
---
Server key
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAAS....
-----END PRIVATE KEY-----
---
No client certificate requested
---
SSL handshake has completed
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_128_GCM_SHA256
    Session-ID: (some hex string)
    ...
```

### Testing without certificate verification (like curl -k)

```bash
# Same as curl -k, shows the TLS details
openssl s_client -connect app1.localhost:443 -servername app1.localhost -showcerts

; You'll see the full certificate chain, issuer, and all the details
```

---

## 4. Commands and what you should see

### Test TLS connection with openssl

```bash
# Full TLS test - this is the "real" way to test before curl
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | head -40
```

Expected output you should see:

```
CONNECTED(00000003)
depth=2 CN=localhost-CA
verify: OK
returned: OK
verify return: OK
---
DSA-SHA256 public key
...
---
Certificate chain
 0 s:/CN=localhost
   i:/CN=localhost-CA
 1 s:/CN=localhost-CA
   i:/CN=localhost-CA
---
Server certificate
-----BEGIN CERTIFICATE-----
MIICyTCCAa.... (Base64 encoded cert)
-----END CERTIFICATE-----
---
Server key
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAAS....
-----END PRIVATE KEY-----
---
No client certificate requested
---
SSL handshake has completed
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_128_GCM_SHA256
    Session-ID: (hex string)
    ...
```

### Key parts of openssl s_client output:

| Part | Meaning |
|------|---------|
| `depth=2 CN=localhost-CA` | Certificate chain depth, issuer name |
| `verify: OK` | Certificate verification passed |
| `SSL handshake has completed` | The TLS handshake succeeded |
| `Protocol  : TLSv1.3` | TLS version being used |
| `Cipher    : TLS_AES_128_GCM_SHA256` | Encryption cipher (modern, secure) |
| `s:/CN=localhost` | Subject = the domain name |
| `i:/CN=localhost-CA` | Issuer = the CA that signed it |

### Test TLS with curl (less detail, more user-friendly)

```bash
# Basic HTTPS test
curl -k https://app1.localhost/

; Expected: HTML content from the app, works with self-signed cert

# With verbose TLS info
curl -v -k https://app1.localhost/

; Expected: Shows SSL connection using TLSv1.3, certificate details
```

### Test certificate chain

```bash
# Show the full certificate chain
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | grep -A2 "Certificate chain"
```

Expected:

```
Certificate chain
 0 s:/CN=localhost
   i:/CN=localhost-CA
 1 s:/CN=localhost-CA
   i:/CN=localhost-CA
```

This shows:
- Certificate 0: Subject = localhost, Issuer = localhost-CA (the server cert)
- Certificate 1: Subject = localhost-CA, Issuer = localhost-CA (the root CA, self-signed)

### Check TLS version and cipher

```bash
# Get just the TLS session info
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | grep "Cipher"
```

Expected:

```
Cipher    : TLS_AES_128_GCM_SHA256
```

This is the "good" cipher - modern TLS 1.3 with AES encryption.

### Verify the certificate details

```bash
# Show certificate subject and issuer
openssl x509 -in /etc/caddy/certs/server-cert.pem -noout -subject -issuer -dates
```

Expected:

```
subject=CN=localhost
issuer=CN=localhost-CA
notBefore=Oct 28 10:18:54 2026 GMT
notAfter=Oct 28 10:18:54 2027 GMT
```

### Check if TLS is working properly (no errors)

```bash
# Quick health check
curl -k -s https://app1.localhost/ | head -5
```

Expected:

```
<h1>Hello from the Node.js app!</h1>
<p>Server port: 3000</p>
```

---

## 5. In a real multi-tenant SaaS

### TLS per tenant:

Each merchant with a custom domain needs their own TLS certificate. There are three approaches:

#### 1. Wildcard certificate (`*.example.com`)

```caddyfile
# One cert covers all subdomains
*.example.com {
  tls /etc/caddy/certs/wildcard-cert.pem /etc/caddy/certs/wildcard-key.pem
  
  # Route based on Host header
  handle {
    route {
      if {host} * "store-a.example.com" {
        reverse_proxy app-a:3000
      }
      if {host} * "store-b.example.com" {
        reverse_proxy app-b:3000
      }
    }
  }
}
```

**Pros**: One cert covers all subdomains. **Cons**: Not all CAs issue wildcards; DNS-01 challenge required.

#### 2. Individual certificates per domain

```caddyfile
store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  reverse_proxy app-a:3000
}

store-b.example.com {
  tls /etc/caddy/certs/store-b-cert.pem /etc/caddy/certs/store-b-key.pem
  reverse_proxy app-b:3000
}
```

**Pros**: Maximum isolation. **Cons**: More management overhead.

#### 3. SAN certificate (Subject Alternative Names)

```caddyfile
# One cert with multiple SANs
example.com {
  tls /etc/caddy/certs/san-cert.pem /etc/caddy/certs/san-key.pem
  
  # All these domains use the same cert
  # Caddy will match the Host header to the right backend
}
```

**SAN example**: Cert valid for `example.com`, `store-a.example.com`, `store-b.example.com`

### SNI (Server Name Indication) in multi-tenant:

SNI is critical for serving different certificates on one IP address:

```http
; The client sends:
ClientHello (SNI: store-a.example.com)

; The server responds with the certificate for store-a.example.com
; NOT the certificate for store-b.example.com
```

Without SNI, all tenants on one IP would share one certificate, which is a security issue.

### HSTS for SaaS:

```caddyfile
# HSTS tells browsers to always use HTTPS
store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
  reverse_proxy app-a:3000
}
```

Once a browser sees HSTS for a domain, it will automatically upgrade HTTP to HTTPS and will never allow downgrade to HTTP for that domain.

### Certificate renewal in SaaS:

```caddyfile
# Caddy handles renewal automatically (with Let's Encrypt)
# For local certs, you'd renew manually or script it
store-a.example.com {
  # Renew local certs every year
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
}
```

---

## 6. When to use it and when NOT to

**Use TLS/HTTPS knowledge when**:
- Configuring HTTPS for your domains
- Understanding certificate chains and CAs
- Debugging "certificate error" messages in browsers
- Setting up SNI for multi-tenant setups
- Implementing HSTS to force HTTPS
- Renewing certificates before they expire

**NOT to skip HTTPS**:
- Never run a SaaS product without HTTPS on custom domains
- Never ignore certificate warnings in browsers
- Never use "HTTP Flexible" SSL mode in production (more on this in the Cloudflare chapter)
- Never share certificates between unrelated domains

---

## 7. Common mistakes

- **CAA records blocking your CA**: If you have CAA records that don't allow Let's Encrypt, certificate issuance will fail. Always check CAA before relying on automatic HTTPS.
- **SNI not supported**: Old clients (very old Android/IE) don't support SNI, so they'll get the wrong certificate or an error.
- **HSTS lockout**: If you enable HSTS and then remove HTTPS, browsers will refuse to connect even to HTTP. HSTS has a "delete" process that takes time.
- **Certificate expiration**: Certificates expire. Set up renewal automation (Caddy does this automatically with Let's Encrypt).
- **Mixing HTTP and HTTPS (mixed content)**: Serving some resources over HTTP and some over HTTPS on the same page. Browsers will show "not secure" warnings.
- **Using the wrong TLS version**: TLS 1.0 and 1.1 are deprecated. Always use TLS 1.2 or 1.3.
- **Private key exposure**: Never share server-side private keys. If a key is compromised, revoke and reissue the certificate.
- **Ignoring the certificate chain**: Some CAs require intermediate certificates to be included. Missing intermediates cause verification failures.

---

## 8. Try it yourself

**Exercise**: Test TLS and observe the connection details.

```bash
# 1. Full TLS test with openssl
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | head -20

; Expected: Shows the TLS handshake succeeded, cipher, certificate chain

# 2. Check certificate details
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -subject -issuer -dates

; Expected: subject=CN=localhost, issuer=CN=localhost-CA, valid for 1 year

# 3. Quick HTTPS test with curl
curl -k -s https://app1.localhost/ | head -3

; Expected: HTML content from the app over HTTPS

# 4. Compare TLS versions
# Try to force an older version (may fail if only TLS 1.3 is configured)
openssl s_client -connect app1.localhost:443 -tls1_2 -servername app1.localhost 2>&1 | grep "Cipher"

; Expected: May return no ciphers if only TLS 1.3 is enabled (TLS 1.3 is default)

# 5. Test with curl verbose to see TLS info
curl -v -k https://app1.localhost/ 2>&1 | grep -i "SSL connection\|TLSv1"
```

**Hint**: If openssl shows `verify: NG` or `verify return: NG`:
1. Check that the CA cert is trusted (you added it to the system or Caddy's trust store)
2. Verify the cert and key match (modulus should match, as we checked earlier)
3. Ensure the server name matches the certificate's CN/SAN

**Cleanup**: No cleanup needed - these commands only read existing certificates and test connections.

---

## Next

[[05b-lets-encrypt-acme]] - Learn about Let's Encrypt and ACME: HTTP-01, TLS-ALPN-01 and DNS-01 challenges, wildcard certificates, renewal, rate limits, and the staging environment.