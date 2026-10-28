# docs/12-custom-domains-saas.md

## 1. Simple explanation (like I'm 7)

**Custom domains for SaaS** is when each merchant gets their own website domain (like `store.example.com`) that points to your SaaS platform. Instead of all merchants being on `your-saas.com/merchant1`, they have their own unique domain.

### The big picture:

1. **Merchant adds domain**: They tell you "my domain is `store.example.com`"
2. **You show DNS instructions**: "Add a CNAME record pointing `store.example.com` to your proxy"
3. **Merchant configures DNS**: They log into their domain registrar and add the record
4. **You verify ownership**: You check that the domain actually points to your proxy (using `dig` or `nslookup`)
5. **Proxy serves the request**: When someone visits `store.example.com`, your proxy (Caddy/Nginx) receives it
6. **Certificate is issued**: HTTPS certificate is generated for that specific domain
7. **App resolves tenant**: Your app looks at the `Host` header and serves the right merchant's content

### Compare with alternatives:

- **One subdomain per tenant**: `merchant1.your-saas.com` (easier certs, more subdomains to manage)
- **Wildcard certificate**: `*.your-saas.com` (one cert covers all, but subdomains only)

---

## 2. Real name

**Custom domains in SaaS** refers to the practice of allowing each tenant/merchant to use their own domain name (e.g., `store.example.com`, `shop.another-business.com`) rather than a subdomain of your SaaS platform.

**Key concepts**:

| Concept | Description |
|---------|-------------|
| **CNAME record** | The DNS record type typically used for custom domains. "My domain is an alias of your proxy domain." |
| **A record** | Alternative to CNAME for root domains. "My domain has a specific IP address." |
| **CAA record** | Controls which Certificate Authority can issue HTTPS certs for this domain. |
| **Host header** | The HTTP header (`Host: store.example.com`) that tells the proxy which tenant to serve. |
| **Tenant resolution** | Looking up which merchant owns the domain from the `Host` header value. |
| **DNS propagation** | The time it takes for DNS changes to spread across the internet (TTL dependent). |
| **Ownership verification** | Proving the domain belongs to the merchant (via TXT record, HTTP response, or DNS record). |

**Custom domain flow**:

```text
Merchant → SaaS Platform → DNS → Proxy → App → Tenant Content
```

---

## 3. Config example

### Caddyfile with custom domain handling (your setup concept)

Since proxy-learn uses `/etc/hosts` instead of real DNS, here's the concept:

```caddyfile
# Custom domain handling for SaaS merchants
# In production with real domains, Caddy would auto-get Let's Encrypt certs

# Tenant A's custom domain
store-a.example.com {
  # Caddy automatically gets a Let's Encrypt certificate for this domain
  # (or uses pre-provisioned local certs in proxy-learn)
  
  # The backend sees Host: store-a.example.com
  reverse_proxy app-a:3000
  
  # Tenant identification via Host header
  header {
    X-Tenant-Id "store-a"
  }
}

# Tenant B's custom domain
store-b.example.com {
  # Separate certificate for this domain
  reverse_proxy app-b:3000
  
  # Different tenant identifier
  header {
    X-Tenant-Id "store-b"
  }
}
```

### Caddy On-Demand TLS for custom domains:

```caddyfile
# On-Demand TLS: certificate issued on first request from this domain
# The `ask` endpoint verifies the domain belongs to a real tenant

store-a.example.com {
  # Caddy will call the ask endpoint before issuing a certificate
  tls {
    ask http://my-tenant-service/verify?domain={host}
  }
  
  # After verification passes, reverse proxy to the right app
  reverse_proxy app-a:3000
  
  # Tenant header for the backend
  header {
    X-Tenant-Id "store-a"
  }
}
```

### Nginx server block for custom domain:

```nginx
# Nginx config for a tenant's custom domain
server {
    listen 443 ssl;
    server_name store-a.example.com;
    
    # SSL certificate (Let's Encrypt via certbot, or provided certs)
    ssl_certificate /etc/letsencrypt/live/store-a.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store-a.example.com/privkey.pem;
    
    # SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Reverse proxy to the tenant's app
    location / {
        proxy_pass http://app-a:3000;
        
        # Forwarded headers for tenant awareness
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Tenant-specific header
    add_header X-Tenant-Id "store-a" always;
}
```

### DNS instructions for merchants (what you show them):

```text
# DNS Configuration Instructions for Custom Domain

# Your domain: store.example.com
# Your SaaS proxy domain: proxy.your-saas.com (or your Caddy domain)

# Option 1: CNAME record (recommended for subdomains)
; Type: CNAME
; Host/Name: store
; Value/Target: proxy.your-saas.com
; TTL: 3600 (1 hour, or as recommended by your SaaS)

; This makes store.example.com an alias of proxy.your-sa.com
; When someone visits store.example.com, DNS resolves to your proxy IP

; Option 2: A record (for root domains, if your registrar allows)
; Type: A
; Host/Name: @ (or your specific subdomain name)
; Value/Target: 1.2.3.4 (your proxy's IP address)
; TTL: 3600

; Option 3: ALIAS/ANAME record (if your DNS provider supports it)
; Type: ALIAS or ANAME
; Host/Name: store
; Value/Target: proxy.your-saas.com
; TTL: 3600
; (Like CNAME but works at the root domain)
```

### Verifying domain ownership (before issuing HTTPS cert):

```bash
# Use dig to verify the domain resolves correctly
dig store.example.com A +short

; Expected output (after merchant adds DNS record):
; (should eventually show your proxy's IP address)

; Use nslookup as well
nslookup store.example.com

; Expected: Should resolve to your proxy's IP

# For ownership verification, one method is HTTP-01 challenge:
; Caddy/Nginx responds to:
; http://store.example.com/.well-known/acme-challenge/random-token
; With a specific string Let's Encrypt provides

; Another method is DNS-01 challenge:
; Add a TXT record: _acme-challenge.store.example.com TXT "random-token"
; Then Let's Encrypt verifies the DNS record propagates

# For proxy-learn local setup (using /etc/hosts):
; We verify by checking the /etc/hosts entry resolves to 127.0.0.1
dig app1.localhost +short

; Expected: 127.0.0.1
```

### Comparing custom domain approaches:

| Approach | Pros | Cons | When to use |
|----------|------|------|-------------|
| **CNAME record** (subdomain) | Works for subdomains; easy to set up; standard practice | Doesn't work at root domain (`example.com` without subdomain) in some registrars | Most SaaS, subdomains per merchant (`store.example.com`) |
| **A record** (root domain) | Works at root domain; no CNAME limitation | Requires IP address changes if proxy IP changes; harder to manage | When merchant wants `example.com` not `store.example.com` |
| **ALIAS/ANAME/flattening** | Works at root domain; like CNAME but auto-updates | Depends on DNS provider support | When merchant wants root domain but CNAME doesn't work |
| **One subdomain per tenant** (`merchant.your-saas.com`) | Simpler cert management (one cert per subdomain) | Merchant doesn't own the main domain part; UI looks like `your-saas.com` | Early SaaS, or when merchants don't need custom domains |
| **Wildcard certificate** (`*.your-saas.com`) | One cert covers all subdomains | Harder to revoke per-tenant; DNS-01 challenge required | When you have many tenants and want simpler cert management |

---

## 4. Commands and what you should test

### Test domain resolution with dig (using /etc/hosts entries)

```bash
# Verify app1.localhost resolves via /etc/hosts
dig app1.localhost +short

; Expected output:
127.0.0.1

; This is what merchants would see after adding their DNS records
; (pointing to your proxy's IP instead of 127.0.0.1)

# Verify app2.localhost resolves
dig app2.localhost +short

; Expected: 127.0.0.1

# Compare CNAME vs A record lookup concepts
; In real DNS (not /etc/hosts):
; CNAME: store.example.com → proxy.your-saas.com
; A record: store.example.com → 1.2.3.4 (proxy IP)
```

### Test that the app sees the correct Host header

```bash
# Through Caddy (HTTPS, your current setup)
curl -k -s https://app1.localhost/ | head -3

; Expected: Shows "Host header: app1.localhost"

; This is what your app sees when a merchant's custom domain is configured
; The app reads the Host header to determine which tenant to serve

# Through Nginx (HTTP)
curl -s http://localhost:8080/ | head -3

; Expected: Shows "Host header: localhost" (from the app's perspective)
```

### Test custom domain flow concept (without real DNS)

```bash
# In proxy-learn, we simulate the custom domain flow using /etc/hosts
# and different Host headers

# 1. Add a "merchant domain" to /etc/hosts (conceptual)
; echo "127.0.0.1 merchant.example.com" >> /etc/hosts

; 2. Now "merchant.example.com" resolves to localhost
dig merchant.example.com +short

; Expected: 127.0.0.1

; 3. The app sees the Host header from the proxy
; Caddy passes the original Host header through reverse_proxy
; So if the request comes with Host: merchant.example.com,
; the app sees that header

# 4. App resolves tenant from Host header
; Your Node.js app code:
; const tenant = lookupTenant(req.get('Host'));

; Expected: If Host is "merchant.example.com", returns the right tenant
```

### Test DNS propagation delay concept

```bash
; Understanding TTL and propagation

; Low TTL (e.g., 300 seconds = 5 minutes):
; Changes propagate quickly, within 5-10 minutes

; High TTL (e.g., 86400 seconds = 24 hours):
; Changes take up to 24 hours to propagate fully

; In proxy-learn, /etc/hosts has TTL 0 (immediate effect)
; Real DNS has TTL set by the domain owner/registrar

; Test the concept:
; If you were to change a real DNS record:
; 1. Set TTL to 300 for quick changes
; 2. Wait 5-10 minutes for propagation
; 3. Test with dig again

; Your proxy-learn /etc/hosts is immediate (no propagation delay)
; Real-world: tell merchants to wait up to 24 hours after adding DNS
```

### Test Host header routing

```bash
; Verify the app differentiates between different Host headers

; In your Express app (already in the app code):
; app.get('/tenant', (req, res) => {
;   const host = req.get('Host');
;   const tenant = tenants[host];  # Lookup in your tenant database
;   res.json({tenant: tenant, host: host});
; });

; Test with different Host headers:
; curl -k https://app1.localhost/headers  # Sees "app1.localhost"
; curl -k https://app2.localhost/headers  # Sees different content/layout

; In proxy-learn, we have app1 and app2 as separate subdomains
; Real SaaS would have merchant1.example.com, merchant2.example.com, etc.
```

### Test CAA record check (before relying on automatic HTTPS)

```bash
; Check CAA records for your domain
; CAA records control which CAs can issue certs

; For proxy-learn local CA, we don't have CAA (or we allow it)
dig app1.localhost CAA +short

; Expected: (empty output - no CAA records, so any CA can issue)

; If CAA exists and blocks your CA:
; dig example.com CAA +short
; Might show: "0 issue "ca.example.com"" (only that CA can issue)

; Important: If you have CAA records that don't allow Let's Encrypt,
; automatic HTTPS will fail. Either remove CAA records or add Let's Encrypt.
```

### Compare CNAME vs A record setup for custom domains

```bash
; CNAME record setup (recommended for most SaaS)
; -------------------------------------------
; Type: CNAME
; Host: store (subdomain part)
; Value: proxy.your-saas.com
; TTL: 3600

; A record setup (for root domains, if supported)
; ----------------------------
; Type: A
; Host: @ (root domain)
; Value: 1.2.3.4 (your proxy's static IP)
; TTL: 3600

; ALIAS/ANAME (if your DNS provider supports it)
; ----------------------------
; Type: ALIAS or ANAME
; Host: store (or @ for root)
; Value: proxy.your-saas.com
; TTL: 3600
; (Auto-updates when proxy IP changes, unlike plain A record)

; In proxy-learn, we use /etc/hosts which is like an A record:
; 127.0.0.1 app1.localhost  (direct IP mapping)

; For SaaS, recommend CNAME for subdomains, ALIAS for root domains
```

### Test the full custom domain flow (simulated in proxy-learn)

```bash
# Simulate what happens when a merchant configures their custom domain:

# 1. Merchant adds "store.example.com" to their DNS (CNAME to your proxy)
; In proxy-learn, we add to /etc/hosts:
; echo "127.0.0.1 store.example.com" >> /etc/hosts

; 2. DNS resolves (in proxy-learn context):
dig store.example.com +short

; Expected: 127.0.0.1 (from /etc/hosts)

; 3. Request comes in with Host: store.example.com
; Caddy receives it and reverse proxies to the app

; 4. App sees Host header and resolves tenant
curl -k -s https://store.example.com/ 2>/dev/null || \
  # If /etc/hosts has the entry, this would work:
curl -k -s https://app1.localhost/ -H "Host: store.example.com" 2>/dev/null | head -3

; Expected: The app sees "store.example.com" as the Host header
; And can look up which tenant owns that domain

; 5. HTTPS is served (local cert in proxy-learn, or Let's Encrypt in production)
; 6. Tenant content is served based on the Host header routing
```

---

## 5. In a real multi-tenant SaaS

### Full custom domain onboarding flow for SaaS:

```text
Step 1: Merchant signs up and enters their custom domain in the SaaS dashboard
Step 2: SaaS shows DNS configuration instructions
Step 3: Merchant adds DNS record at their domain registrar (GoDaddy, Cloudflare, etc.)
Step 4: SaaS verifies the domain resolves to the proxy (using `dig` or `nslookup`)
Step 5: For HTTPS, SaaS initiates Let's Encrypt certificate issuance (HTTP-01 or DNS-01 challenge)
Step 6: Caddy automatically gets the certificate (if using automatic HTTPS)
Step 7: DNS propagation is waited on (TTL dependent, typically 5 min to 24 hours)
Step 8: HTTPS is now active for the merchant's custom domain
Step 9: App receives requests with `Host: store.example.com` header
Step 10: App looks up which tenant owns `store.example.com` and serves the right content
```

### Caddy automatic HTTPS for custom domains:

```caddyfile
# Caddyfile for a SaaS with custom merchant domains

# Each merchant domain gets automatic HTTPS
# Caddy handles Let's Encrypt challenges automatically

# Tenant A
store-a.example.com {
  # Caddy automatically:
  # 1. Starts HTTP-01 challenge (creates .well-known/acme-challenge token)
  # 2. Verifies the token is accessible at http://store-a.example.com/...
  # 3. Gets the Let's Encrypt certificate
  # 4. Renews automatically before expiration
  
  reverse_proxy app-a:3000
  
  # Tenant identification
  header {
    X-Tenant-Id "store-a"
  }
}

# Tenant B
store-b.example.com {
  # Same automatic HTTPS process
  reverse_proxy app-b:3000
  
  header {
    X-Tenant-Id "store-b"
  }
}
```

### Nginx with certbot for custom domains:

```bash
# Get Let's Encrypt certificate for a merchant domain
sudo certbot --nginx -d store-a.example.com

# certbot automatically:
# 1. Starts a temporary web server for HTTP-01 challenge
# 2. Creates the .well-known/acme-challenge response
# 3. Verifies Let's Encrypt can access it
# 4. Installs the certificate
# 5. Modifies Nginx config to use the cert
# 6. Sets up automatic renewal via cron

# Resulting Nginx config (auto-generated):
server {
    listen 443 ssl;
    server_name store-a.example.com;
    
    ssl_certificate /etc/letsencrypt/live/store-a.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store-a.example.com/privkey.pem;
    
    location / {
        proxy_pass http://app-a:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### DNS verification before cert issuance:

```bash
# SaaS verifies domain ownership before issuing HTTPS

# Method 1: HTTP-01 challenge verification
; SaaS creates a temporary endpoint:
; GET http://store-a.example.com/.well-known/acme-challenge/random-string
; Expected response: the specific token Let's Encrypt provided

; If the endpoint returns the right string, domain ownership is verified
; And Let's Encrypt certificate can be issued

# Method 2: DNS-01 challenge verification
; SaaS creates a TXT DNS record:
; _acme-challenge.store.example.com  IN  TXT  "random-string"

; Merchant (or their DNS provider) adds this TXT record
; SaaS checks that the DNS record propagates and contains the right string
; Then Let's Encrypt issues the certificate using DNS-01

# proxy-learn local equivalent (using /etc/hosts and local CA):
; We verify by:
; 1. Adding the domain to /etc/hosts pointing to 127.0.0.1
; 2. The domain resolves and HTTPS works via our local CA
; 3. No Let's Encrypt involvement (we use local certificates)
```

### Per-tenant rate limiting using Host header:

```caddyfile
# Rate limit per tenant using their custom domain as the identifier

store-a.example.com {
  # Rate limit based on the tenant's custom domain
  # Caddy/application can use X-Forwarded-For + Host combination
  
  reverse_proxy app-a:3000
  
  # The app can rate limit based on:
  # - X-Forwarded-For (client IP)
  # - Host (tenant domain)
  # - Combination of both
}
```

### HSTS for custom domains:

```caddyfile
# HSTS - force HTTPS for each merchant's custom domain

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # HSTS tells browsers to always use HTTPS for this domain
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
  
  reverse_proxy app-a:3000
}
```

### Revoking certificates when merchant leaves:

```bash
# Revoke a merchant's certificate if they leave the SaaS
sudo certbot revoke --certificate store-a.example.com

; Or via Caddy admin API (if using Let's Encrypt):
; curl -X POST http://localhost:2019/certificates/revoke \
;   -d '{"domains": ["store-a.example.com"]}'

; Then:
# 1. Remove the domain from your SaaS dashboard
# 2. Revoke their HTTPS certificate
# 3. Their domain will show "certificate error" in browsers
; 4. Eventually the cert expires naturally (90 days for Let's Encrypt)
# 5. Clean up their DNS records if desired
```

### Multi-tenant SaaS custom domain topology:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SAAS PLATFORM INFRASTRUCTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ Merchant 1  │   │ Merchant 2  │   │ Merchant 3  │            │
│  │ store1.com  │   │ store2.com  │   │ store3.com  │            │
│  └────┬────────┘   └────┬────────┘   └────┬────────┘            │
│       │                   │                   │                │
│       │                   │                   │                │
│   DNS CNAME              DNS CNAME            DNS CNAME         │
│   store1.com →         store2.com →          store3.com →      │
│   proxy.your-saas.com  proxy.your-saas.com  proxy.your-saas.com│
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐      │
│  │          REVERSE PROXY (Caddy or Nginx)                │      │
│  │                                                      │      │
│  │  store1.com  → HTTPS → app1 → Tenant 1 content      │      │
│  │  store2.com  → HTTPS → app2 → Tenant 2 content      │      │
│  │  store3.com  → HTTPS → app3 → Tenant 3 content      │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  Each tenant gets:                                               │
│  • Their own custom domain (store1.com, store2.com, store3.com) │
│  • HTTPS certificate (automatic via Let's Encrypt or pre-provided)│
│  • Host header routing (app knows which tenant from Host)     │
│  • Per-tenant security headers and rate limiting              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Custom domain flow diagram:

```text
+----------------------+        +----------------------+        +----------------------+
|   Merchant's         |        |   SaaS Platform      |        |   Browser/Client   |
|   Domain (store.com) |        |  (your SaaS)         |        |  (visits store.com) |
+----------+-----------+        +----------+-----------+        +----------+-----------+
         |                           |                            |
         | 1. Add domain to dashboard|                            |
         |-------------------------->|                            |
         |                           |                            |
         | 2. Show DNS instructions  |                            |
         |   (CNAME → proxy.domain) |                            |
         |                           |                            |
         |                           | 3. Merchant adds DNS    |--|
         |                           |   record at registrar   |  |
         |                           |------------------------>|  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
         |                           |                            |  |
    ----------------------------->  Verification (dig/nslookup)  <--------------
         |                           |                            |
         | 4. Verify domain resolves |                            |
         |   to our proxy IP         |                            |
         |-------------------------->|                            |
         |                           |                            |
         | 5. HTTPS certificate      |                            |
         |   issued (Let's Encrypt)  |                            |
         |                           |                            |
         |                           | 6. Request: https://    |--|
         |                           |   store.com             |  |
         |                           |------------------------>|  |
         |                           |                            |  |
         |                           | 7. Proxy receives req:  |  |
         |                           |   Host: store.com       |  |
         |                           |   (step 8 routing)      |  |
         |                           |------------------------>|  |
         |                           |                            |  |
         |                           | 8. App reads Host header|--|
         |                           |   "store.com"         |  |
         |                           |   → looks up tenant   |  |
         |                           |   → serves content    |  |
         |                           |------------------------>|  |
         |                           |                            |  |
         |                           | 9. HTTPS response      |--|
         |                           +--------------------------+
```

---

## 6. When to use it and when NOT to

**Use custom domain knowledge when**:
- Setting up SaaS with merchant custom domains
- Configuring DNS records (CNAME, A, ALIAS)
- Verifying domain ownership (before HTTPS)
- Issuing per-tenant HTTPS certificates
- Routing requests based on the `Host` header
- Comparing subdomain-per-tenant vs wildcard cert approaches

**NOT to skip domain verification**:

- Never issue HTTPS certificates without verifying domain ownership first
- Never skip DNS propagation waiting time (TTL dependent)
- Never assume a domain works without testing `dig` or `nslookup`
- Never ignore CAA records that might block your CA from issuing certs
- Never skip the Host header routing logic (app needs to know which tenant)

---

## 7. Common mistakes

- **CNAME at the apex problem**: Trying to use a CNAME record for `example.com` (root domain) instead of `sub.example.com`. Some DNS providers don't allow this. Use ALIAS, ANAME, or DNS flattening instead.
- **Forgetting to wait for DNS propagation**: Telling merchants their domain "should work immediately" when TTL is 24 hours. Always say "may take up to 24 hours."
- **Not verifying domain ownership**: Trying to issue Let's Encrypt certs before the domain actually resolves to your proxy. Always test with `dig` first.
- **Ignoring CAA records**: If the merchant's domain has CAA records that don't allow Let's Encrypt, automatic HTTPS will fail. Check and handle CAA records.
- **Using `www` vs non-www inconsistently**: Some merchants expect `store.example.com`, others `www.store.example.com`. Pick one and redirect the other.
- **Not routing by Host header**: The app receives requests but doesn't check which domain is making the request, serving the same content to all tenants.
- **Wildcard cert security issues**: Wildcard certs (`*.example.com`) can be abused if one tenant's subdomain is compromised. Per-tenant certs are more secure but more management overhead.
- **Forgetting HSTS after HTTPS**: Once HSTS is set for a domain, browsers will never allow HTTP even if you want to. Make sure HTTPS is truly ready before enabling HSTS.
- **Redirect loops during domain onboarding**: HTTP→HTTPS redirect + custom domain config issues can create loops. Test the full flow before showing merchants.

---

## 8. Try it yourself

**Exercise**: Test custom domain concepts using your proxy-learn setup.

```bash
# 1. Test domain resolution with /etc/hosts (simulating custom domains)
echo "=== Testing domain resolution ==="

; Add test "merchant domains" to /etc/hosts
echo "127.0.0.1 store1.example.com" >> /etc/hosts
echo "127.0.0.1 store2.example.com" >> /etc/hosts

; Verify they resolve
dig store1.example.com +short
dig store2.example.com +short

; Expected: Both show 127.0.0.1

# 2. Test that the app differentiates between different Host headers
echo ""
echo "=== Testing Host header routing ==="

; Test with store1 "domain"
curl -k -s https://store1.example.com/ 2>/dev/null || \
  curl -k -s https://app1.localhost/ -H "Host: store1.example.com" | head -3

; Test with store2 "domain"
curl -k -s https://store2.example.com/ 2>/dev/null || \
  curl -k -s https://app1.localhost/ -H "Host: store2.example.com" | head -3

; Expected: The app (Node.js) sees different Host headers and can
; differentiate between the "tenants"

# 3. Compare which Host header the app sees
echo ""
echo "=== Current app output ==="
curl -k -s https://app1.localhost/headers 2>/dev/null

; Expected: Shows "Host header: app1.localhost"
; If you pass a custom Host header, it would show that instead

# 4. Test DNS propagation concept (no real DNS changes)
echo ""
echo "=== DNS propagation delay concept ==="

; In proxy-learn (/etc/hosts), changes are immediate (TTL 0)
; In real DNS, changes take time based on TTL

; Tell the merchant concept:
; "After you add your DNS record, it may take 5-24 hours to propagate
;  fully worldwide. During this time, some users may still see the
;  old location. Typical propagation: 5 minutes to 2 hours."

; Your /etc/hosts is instant - no propagation needed!

# 5. Test dig/nslookup for domain verification
echo ""
echo "=== Verification commands ==="

; These are what you'd tell merchants to run after adding DNS
echo "dig store1.example.com A +short"
dig store1.example.com A +short

echo ""
echo "nslookup store1.example.com"
nslookup store1.example.com

; Expected: Both should show 127.0.0.1 (from our /etc/hosts entries)

# 6. Test the full simulated custom domain flow
echo ""
echo "=== Simulated custom domain flow ==="

; 1. Merchant adds domain (we added to /etc/hosts)
; 2. DNS resolves (dig shows 127.0.0.1)
; 3. Request comes in with Host header
; 4. App routes to right tenant
; 5. HTTPS is served

; 6. The key insight:
;    - In real world: DNS propagation + domain verification + cert issuance
;    - In proxy-learn: /etc/hosts entry + reverse_proxy + local CA HTTPS

; 7. Real SaaS steps:
;    a. Merchant adds CNAME record at registrar
;    b. SaaS verifies with `dig` 
;    c. SaaS waits for DNS propagation (TTL dependent)
;    d. SaaS initiates Let's Encrypt cert (HTTP-01 or DNS-01)
;    e. HTTPS activates
;    f. App routes by Host header

# 7. Clean up /etc/hosts changes
echo ""
echo "=== Cleaning up /etc/hosts ==="

; Remove the test entries we added
; (Keep the original app1 and app2 entries, remove the test ones)
; sed -i '/store1.example.com/d' /etc/hosts
; sed -i '/store2.example.com/d' /etc/hosts

; Expected: /etc/hosts restored to original state with just app1 and app2

; Cleanup note: The test entries were added for demonstration.
; In a real scenario, the merchant would add their own domains.
```

**Hint**: Key differences between custom domain approaches:

| Approach | Best for | Complexity | Security |
|----------|----------|------------|----------|
| **CNAME subdomain** (`store.example.com`) | Most SaaS | Low-Medium | High (per-tenant certs) |
| **A record root domain** (`example.com`) | Merchants wanting root domain | Medium | High |
| **ALIAS/ANAME** | Root domain without CNAME limitation | Low-Medium | High |
| **Wildcard cert** (`*.example.com`) | Many tenants, similar subdomains | Low | Medium (one cert covers all) |
| **One subdomain per tenant** (`merchant.your-saas.com`) | Early SaaS, simple setup | Low | High (isolated certs) |

**Cleanup**: Remove the test /etc/hosts entries we added for demonstration (or leave them if you want to keep the test domains).

---

## Next

[[13-cdn-cloudflare]] - Learn about CDN and Cloudflare: proxied vs DNS-only mode, SSL modes (and why "Flexible" is dangerous), and caching.