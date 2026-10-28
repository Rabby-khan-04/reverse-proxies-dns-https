# docs/05b-lets-encrypt-acme.md

## 1. Simple explanation (like I'm 7)

**Let's Encrypt** is a free, automated certificate authority that gives websites HTTPS certificates for free. It's like a vending machine for HTTPS locks:

1. **You prove you own the domain**: "I promise `app1.localhost` is mine!"
2. **Let's Encrypt checks**: They verify your proof (this is the "challenge" part)
3. **They give you a certificate**: A free HTTPS lock for your domain
4. **It works automatically**: Your web server (Caddy or Nginx) gets the cert without you doing paperwork
5. **It renews itself**: Before the certificate expires, Let's Encrypt renews it automatically

**Staging environment** is a special "practice mode" where you can test everything without real limits. It gives you fake certificates that browsers don't trust in production, but are fine for testing.

Think of it like: "Practice mode for getting free HTTPS locks."

---

## 2. Real name

**Let's Encrypt** is a non-profit Certificate Authority that provides free X.509 certificates for TLS encryption. It operates using the **ACME (Automatic Certificate Management Environment)** protocol, which automates the process of obtaining, validating, renewing, and revoking digital certificates.

**Key ACME components**:

| Component | Description |
|-----------|-------------|
| **Account** | Your identity with Let's Encrypt (email, contact info, registration URL) |
| **Nonce** | A one-time value that lets you make API requests (anti-replay protection) |
| **Certificate** | The X.509 TLS certificate for your domain |
| **Order** | A request for a certificate for specific domain(s) |
| **Authorization** | Proof that you control a specific domain |
| **Challenge** | The method you use to prove domain ownership |

**Challenge types** (ways to prove you own a domain):

| Challenge | How it works | When to use |
|-----------|-------------|-------------|
| **HTTP-01** | Your web server responds to `http://domain/.well-known/acme-challenge/token` with a specific value | Most common; works when port 80 is open |
| **TLS-ALPN-01** | TLS handshake includes a special token; server presents it during the handshake | Works on port 443 only; good for automation |
| **DNS-01** | A TXT record is added to your DNS: `_acme-challenge.domain TXT "token"` | Required for wildcard certs; works even if ports are blocked |

**Rate limits** are limits on how many certificates you can request. Let's Encrypt wants to prevent abuse:

| Limit | Description |
|-------|-------------|
| **New certificate** | Max 5 certificates per domain per week |
| **Renewal** | Unlimited renewals (they don't count toward the limit) |
| **Duplicate certificate** | Max 5 certificates with the same domains per week |
| **Registered domains** | Max 100 registrations per open API call |
| **Account** | Max 300 accounts per IP address |

**Staging environment** (`--stage`) uses a separate server with higher limits, perfect for testing:

```bash
# Caddy uses staging automatically when testing
# Let's Encrypt CLI: certbot --staging
```

---

## 3. Config example

### Caddyfile with Let's Encrypt automatic HTTPS (staging mode)

**Important**: In your `proxy-learn/` setup, we're using **local certificates**, not Let's Encrypt. But here's how it would look:

```caddyfile
# This would use Let's Encrypt if you had real domains
# For proxy-learn, we use local CA instead

app1.localhost {
  # Uncomment the line below to use Let's Encrypt instead of local certs
  # tls >>>> THE LET'S ENCRYPT CHALLENGE HANDLER WOULD GO HERE <<<<
  
  # Instead, we use our local certificates:
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  reverse_proxy app:3000
}
```

### Caddy automatic HTTPS (what you'd use with real domains):

```caddyfile
# Caddy's default: automatic HTTPS using Let's Encrypt
# No `tls` directive needed - Caddy handles everything

app1.localhost {
  # Caddy will automatically:
  # 1. Issue a Let's Encrypt certificate
  # 2. Renew it before expiration
  # 3. Handle HTTP-01 challenges
  reverse_proxy app:3000
}
```

### Caddy On-Demand TLS (chapter 8 topic - `ask` endpoint):

```caddyfile
# On-Demand TLS: certificate issued only on first request
app1.localhost {
  # The `ask` endpoint must verify the domain belongs to a real tenant
  # This is chapter 8 material - see below
  tls {
    dns challenge-provider dns_provider_name
  }
  
  reverse_proxy app:3000
}
```

### Nginx with certbot (certificate installation):

```bash
# Install certbot and get a certificate
sudo apt-get install certbot

# Get a certificate for a domain (HTTP-01 challenge)
sudo certbot --nginx -d app1.localhost -d store.example.com

# Get a wildcard certificate (DNS-01 challenge)
sudo certbot --nginx -d example.com -d "*.example.com"

# Renew all certificates (renewal is automatic via cron)
sudo certbot renew
```

### Nginx server block with Let's Encrypt certs:

```nginx
# After certbot installs certs, Nginx config looks like:
server {
    listen 443 ssl;
    server_name app1.localhost;
    
    # Certbot automatically inserts these paths
    ssl_certificate /etc/letsencrypt/live/app1.localhost/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app1.localhost/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### DNS-01 challenge TXT record (for wildcard certs):

```text
; To prove you control the domain, you add this TXT record:
_acme-challenge.example.com.  IN  TXT  "randm-string-for-verification"

; Caddy/LetsEncrypt will automatically:
; 1. Add this TXT record to your DNS
; 2. Verify it's propagates
; 3. Remove it after certificate is issued
```

---

## 4. Commands and what you should see

### Test Let's Encrypt staging (conceptual - we use local certs)

```bash
# The certbot command for staging (conceptual)
# In proxy-learn, we don't run this - we use local CA instead

# If you had real domains, you'd run:
# sudo certbot --staging --nginx -d app1.localhost

; Expected output (staging, not real):
Obtaining a certificate for app1.localhost
Performing the ACME protocol
Using the staging environment (no real limits)
Requesting a certificate
Performing the HTTP-01 challenge
Challenge verified!
Requesting done!
```

### Check certificate expiration

```bash
# Check how long until the certificate expires
sudo certbot certificates

; Expected output:
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Found 1 certificates:
  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  Certificate Name: app1.localhost
  Domains: app1.localhost
  Expiry Date: 2027-01-27 00:00:00 +00:00 (roughly 3 months from now)
  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

### Check Let's Encrypt account status

```bash
# Show account info (staging)
sudo certbot accounts

; Expected: Shows your registered email and account ID with Let's Encrypt
```

### Test certificate verification

```bash
# Verify the certificate chain works
openssl verify -CAfile /etc/letsencrypt/chained.pem /etc/letsencrypt/live/app1.localhost/cert.pem

; Expected: OK
```

### Check rate limit status (if you've hit limits)

```bash
# This would show if you're approaching rate limits
; Not typically needed in staging, but:
cat /var/log/letsencrypt/letsencrypt.log 2>/dev/null | grep -i "rate limit"
```

### Simulate certificate issuance (dry run)

```bash
# Test that your config would work without actually issuing a cert
# Certbot dry run
sudo certbot --staging --dry-run --nginx -d app1.localhost

; Expected: " dryer run successful" if your config is correct
```

### For proxy-learn local CA (what you're actually using):

```bash
# Check your local certs
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -dates
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/ca-cert.pem -noout -subject

; Expected output you should see:
; server-cert.pem:
; notBefore=Oct 28 10:18:54 2026 GMT
; notAfter=Oct 28 10:18:54 2027 GMT
;
; ca-cert.pem:
; subject=CN=localhost-CA
```

### Verify the local CA chain

```bash
# Show the full chain verification
openssl verify -CAfile /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/ca-cert.pem /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem

; Expected: OK
```

---

## 5. In a real multi-tenant SaaS

### Let's Encrypt for SaaS custom domains:

```caddyfile
# Caddy handles Let's Encrypt automatically for each tenant domain
# This is the power of Caddy's automatic HTTPS

# Tenant A
store-a.example.com {
  # Caddy automatically gets and renews the cert
  reverse_proxy app-a:3000
}

# Tenant B
store-b.example.com {
  # Caddy automatically gets and renews the cert  
  reverse_proxy app-b:3000
}

# Wildcard for all subdomains
*.example.com {
  # One wildcard cert covers all subdomains
  # But requires DNS-01 challenge setup
  reverse_proxy * 
}
```

### ACME challenges in SaaS context:

#### HTTP-01 challenge flow:

```text
1. Browser requests https://store-a.example.com/
2. Caddy receives request, sees no certificate yet
3. Caddy initiates HTTP-01 challenge:
   - Creates: /well-known/acme-challenge/random-token
   - Returns specific HTTP response with that token
4. Let's Encrypt verifies the response
5. Let's Encrypt issues the certificate
6. Caddy serves HTTPS to the browser
```

#### DNS-01 challenge flow (for wildcard certs):

```text
1. Caddy needs a wildcard cert: *.example.com
2. Caddy initiates DNS-01 challenge:
   - Generates: TXT record _acme-challenge.example.com with token
   - Caddy configures your DNS provider API to add this record
3. DNS propagates globally (TTL dependent)
4. Let's Encrypt sees the TXT record, verifies it
5. Let's Encrypt issues the wildcard certificate
6. Caddy serves HTTPS for all subdomains
```

### Rate limit considerations for SaaS:

| Scenario | Strategy |
|----------|----------|
| **New merchant onboards** | Use staging environment initially; real certs after verification |
| **Merchant adds many subdomains** | Use wildcard cert (`*.example.com`) to avoid per-certificate limits |
| **Frequent cert renewals** | Let's Encrypt unlimited renewals; don't worry about the limit |
| **Many tenants on one domain** | Not possible - each needs their own cert or wildcard |
| **Testing automation** | Always use `--staging` flag to avoid hitting real limits |

### SAN certificates for multiple domains:

```caddyfile
# One certificate with multiple SANs (Subject Alternative Names)
# Good for a few specific domains, not unlimited

example.com, store.example.com, admin.example.com {
  tls /etc/caddy/certs/san-cert.pem /etc/caddy/certs/san-key.pem
  
  # Caddy will match the Host header to the right backend
  handle {
    route {
      if {host} * "store.example.com" {
        reverse_proxy app-store:3000
      }
      if {host} * "admin.example.com" {
        reverse_proxy app-admin:3000
      }
    }
  }
}
```

### Certificate expiration and renewal automation:

```caddyfile
# Caddy automatically renews Let's Encrypt certs
# For local certs, you'd script the renewal

# Caddy handles this automatically - no config needed for Let's Encrypt
# For local certs, renew manually or script it:
#
# renew-local-certs.sh:
# #!/bin/bash
# openssl req -x509 -newkey rsa:2048 -keyout ca-key.pem -out ca-cert.pem -days 365 -nodes -subj "/CN=localhost-CA"
# openssl x509 -req -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -days 365
#
# crontab -e
# 0 2 * * * /path/to/renew-local-certs.sh
```

### HSTS for SaaS tenants:

```caddyfile
# HSTS - forces browsers to always use HTTPS
# Once set, browsers remember for 1 year (max-age=31536000)

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
  reverse_proxy app-a:3000
}
```

### Revoking certificates (if needed):

```bash
# Revoke a compromised certificate
sudo certbot revoke --certificate app1.localhost

# Use cases:
# - Private key was leaked
# - Certificate was issued by mistake
# - Merchant left the SaaS and you need to revoke their cert
```

---

## 6. When to use it and when NOT to

**Use Let's Encrypt ACME knowledge when**:
- Setting up HTTPS for custom domains in SaaS
- Automating certificate renewal
- Debugging "certificate error" or "site not secure" messages
- Configuring Caddy's automatic HTTPS
- Choosing between HTTP-01, TLS-ALPN-01, and DNS-01 challenges
- Understanding rate limits to avoid certificate issuance failures

**NOT to skip HTTPS for SaaS domains**:
- Never launch a SaaS product without HTTPS on custom domains
- Never ignore certificate expiration (renew before 30 days!)
- Never use the production environment for testing without understanding limits
- Never ignore CAA records that might block your CA

---

## 7. Common mistakes

- **Using production environment for testing**: Always use `--staging` or you'll hit rate limits quickly
- **Not understanding rate limits**: New cert limit is 5 per domain per week; renewals are unlimited
- **Forgetting CAA records**: If CAA exists and doesn't allow your CA, cert issuance will fail silently or with an error
- **DNS-01 without proper DNS provider config**: The TXT record must actually propagate to be valid
- **HTTP-01 with port 80 blocked**: If your firewall blocks port 80, HTTP-01 won't work; use DNS-01 instead
- **Wildcard cert without DNS-01**: You cannot get wildcard certs via HTTP-01; must use DNS-01
- **Not renewing early**: Certificates expire in 90 days (Let's Encrypt). Renew at least 30 days before expiration
- **Ignoring the "staging" vs "production" distinction**: Hitting production rate limits can lock you out temporarily
- **Mixing challenge types**: Don't try HTTP-01 and DNS-01 simultaneously for the same domain without understanding the implications

---

## 8. Try it yourself

**Exercise**: Understand Let's Encrypt concepts and the differences between challenge types.

```bash
# 1. Check your local certificate setup (what proxy-learn uses)
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -subject -issuer -dates

; Expected: 
; subject=CN=localhost
; issuer=CN=localhost-CA
; notBefore=Oct 28 10:18:54 2026 GMT
; notAfter=Oct 28 10:18:54 2027 GMT

; This is NOT a Let's Encrypt cert - it's your local CA
; Let's Encrypt certs would show:
; subject=CN=app1.localhost (or your domain)
; issuer=C=US, O=Let's Encrypt, CN=Let's Encrypt Authority X3

# 2. Understand the difference - compare local vs Let's Encrypt
; Local CA (what you have):
; - Free but you manage it
; - Cert valid for 1 year (you set the days)
; - No rate limits (you control it)
; - Not trusted by browsers by default (need to add trust)

; Let's Encrypt:
; - Free, automated
; - Cert valid for 90 days
; - Rate limits apply (5 new certs/domain/week)
; - Trusted by all major browsers automatically

# 3. Check if Caddy is using local or Let's Encrypt certs
docker compose logs caddy 2>&1 | grep -i "automatic\|certificate\|tls"

; Expected: Should show Caddy is using local certs (we configured tls in Caddyfile)
; Or would show "skipping automatic certificate management because one or more matching certificates are already loaded"

# 4. Simulate what Let's Encrypt would do (dry run concept)
; In proxy-learn, we can't run certbot, but you can understand the flow:
; - certbot would add a TXT record to DNS for DNS-01
; - certbot would start a temporary HTTP server for HTTP-01
; - certbot would verify the challenge
; - certbot would download the cert and configure the server

# 5. Test certificate chain with your local CA
openssl verify -CAfile /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/ca-cert.pem /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem

; Expected: OK
; This verifies your server cert was signed by your CA
```

**Hint**: If you want to understand what Let's Encrypt would do:
1. The key difference is: **Let's Encrypt is trusted by browsers by default**; your local CA is not
2. **Let's Encrypt has rate limits**; your local CA doesn't
3. **Let's Encrypt certs last 90 days**; your local certs can last as long as you want
4. **Let's Encrypt uses ACME protocol**; your local CA is just openssl commands

**Cleanup**: No cleanup needed - these commands only read existing certificates and understand the concepts.

---

## Next

[[06-caddy]] - Learn about Caddy: the Caddyfile, automatic HTTPS, `reverse_proxy`, headers, handle blocks, logging, and admin API basics.