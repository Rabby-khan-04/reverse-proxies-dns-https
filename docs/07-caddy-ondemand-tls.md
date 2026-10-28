# docs/07-caddy-ondemand-tls.md

## 1. Simple explanation (like I'm 7)

**On-Demand TLS** is Caddy's superpower: it can automatically get HTTPS certificates *only when someone first visits your website*. Before that, there's no certificate sitting there wasting resources.

### How it works:

1. **First visitor comes**: Someone types `store-a.example.com` in their browser
2. **Caddy checks**: "Do we have a certificate for this domain?"
3. **No certificate yet**: Caddy pauses and says "Wait, I need to get a certificate first"
4. **Caddy calls the `ask` endpoint**: "Hey verification service, does this domain belong to a real tenant?"
5. **Your service answers**: "Yes, store-a.example.com is a real tenant!" (or "No, this is fake.")
6. **Caddy gets the certificate**: Let's Encrypt or other CA issues a cert for this domain
7. **Page loads with HTTPS**: The visitor sees the secure page
8. **Future visitors**: No delay - the certificate is already there

### Why this is great for SaaS:

- **No pre-provisioning**: You don't need to get a certificate for every new merchant before they even sign up
- **Each merchant gets their own cert**: Even on a shared domain or subdomain, each gets their own valid HTTPS cert
- **Automatic renewal**: Just like regular Let's Encrypt certs, these renew automatically
- **Pay-per-use**: Certificates are only generated when needed

### The risk if you get it wrong:

If the `ask` endpoint doesn't properly verify the domain, attackers could:
- Get HTTPS certificates for domains they don't own
- Exhaust Let's Encrypt rate limits
- Intercept traffic or perform man-in-the-middle attacks

That's why the `ask` endpoint is the most important security part of On-Demand TLS.

---

## 2. Real name

**Caddy On-Demand TLS** is a feature where Caddy defers TLS certificate issuance until the first incoming HTTPS request for a domain. It uses the ACME protocol (same as Let's Encrypt) but triggered on-demand via an `ask` endpoint.

**Key concepts**:

| Concept | Description |
|---------|-------------|
| **On-Demand TLS** | Certificate issuance triggered by first HTTPS request, not before |
| **`ask` endpoint** | HTTP endpoint that Caddy calls to verify the domain belongs to a real tenant |
| **Tenant verification** | The `ask` endpoint must check that the requesting domain is owned/authorized by a real customer |
| **Abuse risk** | If `ask` doesn't verify properly, attackers can get certs for any domain |
| **Rate-limit risk** | If `ask` doesn't rate-limit, attackers can exhaust Let's Encrypt's limits quickly |
| **Staging vs production** | Always test `ask` endpoint in Let's Encrypt staging first! |
| **`tls` directive** | In Caddyfile: `tls { ask http://your-endpoint/verify }` |

**The On-Demand TLS flow**:

```text
1. Browser requests: https://store-a.example.com/
2. Caddy receives request, sees no certificate for this domain
3. Caddy pauses the request
4. Caddy calls: GET http://your-verification-service/ask?domain=store-a.example.com
5. Your service checks: Does store-a.example.com belong to a real tenant?
6. Your service responds:
   - 2xx (e.g., 200 OK): "Yes, proceed!" → Caddy gets cert from Let's Encrypt
   - 4xx (e.g., 403 Forbidden): "No way!" → Caddy returns 403 to browser
   - 429 Too Many Requests: "Slow down!" → Caddy handles rate limiting
7. Caddy gets certificate (if step 6 was 2xx)
8. TLS handshake completes, page loads securely
9. Future requests: certificate already exists, no delay
```

---

## 3. Config example

### Caddyfile with On-Demand TLS `ask` endpoint:

```caddyfile
# On-Demand TLS: certificate issued on first request
# The `ask` endpoint MUST verify the domain belongs to a real tenant

store-a.example.com {
  # Caddy will call this endpoint before issuing a certificate
  # If the endpoint returns anything other than 2xx, no cert is issued
  tls {
    ask http://tenant-verification-service/verify
  }
  
  # Reverse proxy to the tenant's app
  reverse_proxy app-a:3000
  
  # Security headers
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
  }
}
```

### The `ask` endpoint expected behavior:

```python
# Example Python Flask endpoint for tenant verification
from flask import Flask, request, jsonify

app = Flask(__name__)

# Database or data structure of real tenants
REAL_TENANTS = {
    "store-a.example.com": "tenant-a-id",
    "store-b.example.com": "tenant-b-id", 
    "store-c.example.com": "tenant-c-id",
}

@app.route('/verify', methods=['GET'])
def verify():
    domain = request.args.get('domain', '')
    
    # Check if this domain belongs to a real tenant
    if domain in REAL_TENANTS:
        # Return 2xx - Caddy will issue the certificate
        return jsonify({
            "domain": domain,
            "tenant_id": REAL_TENANTS[domain],
            "verified": True
        }), 200
    
    # Return 4xx - Caddy will NOT issue a certificate
    # Browser will see an error (certificate error or 403)
    return jsonify({
        "domain": domain,
        "verified": False,
        "error": "Domain not found in tenant registry"
    }), 403

@app.route('/verify', methods=['GET'])
def verify_rate_limited():
    domain = request.args.get('domain', '')
    ip = request.remote_addr
    
    # Rate limiting: max 5 requests per minute per IP
    # (simplified - use proper rate limiter in production)
    
    if domain in REAL_TENANTS:
        return jsonify({"domain": domain, "verified": True}), 200
    else:
        # 429 = rate limit, Caddy will retry later
        # 403 = not verified, Caddy will NOT issue cert
        return jsonify({"error": "Domain not authorized"}), 403
```

### Caddyfile with On-Demand TLS and tenant identification:

```caddyfile
# Full On-Demand TLS flow for SaaS
*.example.com {
  # On first HTTPS request, verify the domain
  tls {
    ask http://my-tenant-service/verify
  }
  
  # Route based on the specific subdomain
  handle {
    route {
      # If the domain is authorized, Caddy will have issued a cert
      # and we can route to the right tenant
      if {host} * "store-a.example.com" {
        reverse_proxy app-a:3000
        header {
          X-Tenant-Id "store-a"
        }
      }
      if {host} * "store-b.example.com" {
        reverse_proxy app-b:3000
        header {
          X-Tenant-Id "store-b"
        }
      }
      
      # If no domain matches, show 404
      response 404 "No tenant found"
    }
  }
}
```

### Caddyfile with On-Demand TLS using DNS-01 challenge:

```caddyfile
# On-Demand TLS with DNS-01 (for wildcard certs or when port 80 is blocked)
*.example.com {
  # Caddy will use DNS-01 challenge via your DNS provider
  tls {
    # The ask endpoint must still verify the domain
    ask http://my-tenant-service/verify
    
    # DNS-01 challenge configuration
    dns provider-name challenge-provider digitalocean
  }
  
  reverse_proxy app:3000
}
```

### Comparing On-Demand TLS approaches:

| Approach | When to use | Pros | Cons |
|----------|-------------|------|------|
| **`ask` endpoint** | SaaS with custom domains per tenant | Each tenant gets their own cert; only issued when needed | Must secure the `ask` endpoint properly |
| **Pre-provisioned certs** | Few tenants, known in advance | No `ask` endpoint needed; simpler | Must get certs before tenants need them |
| **Wildcard cert** | Many tenants, all on `*.example.com` | One cert covers all; easier management | Harder to revoke individual tenants; DNS-01 required |
| **SAN cert** | Moderate number of specific domains | One cert with multiple SANs | Limited number of SANs per cert (usually 100) |

---

## 4. Commands and what you should test

### Test On-Demand TLS flow (conceptual - in proxy-learn we use local certs)

```bash
# In proxy-learn, we use local certificates, not On-Demand TLS
# But you can understand the flow:

# 1. Check current cert setup
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -subject

; Expected: subject=CN=localhost (local cert, not On-Demand TLS)

# 2. Understand the difference - On-Demand TLS would show:
; - Cert issued only when first request comes in
; - Caddy calls the `ask` endpoint first
; - If 2xx: cert is issued, request proceeds
; - If 4xx: cert is NOT issued, request fails

# 3. Test that local certs work (what proxy-learn uses)
curl -k -s https://app1.localhost/ | head -3

; Expected: HTML from the app works with local certs

# 4. Simulate what On-Demand TLS would do
; In real setup with real domains:
; 1. First request to https://store-a.example.com/
; 2. Caddy pauses and calls the `ask` endpoint
; 3. If endpoint returns 200 OK: Caddy gets Let's Encrypt cert
; 4. TLS handshake completes, page loads
; 5. Future requests: already have the cert

# 5. Check Caddy version supports On-Demand TLS
caddy version 2>&1 | head -1

; Expected: Caddy v2.0+ supports On-Demand TLS
; (your installed version should support it)
```

### Test Caddy config syntax (validate your Caddyfile)

```bash
# Validate the Caddyfile syntax
caddy fmt --check Caddyfile 2>&1

; Expected: "OK" if syntax is correct, or error messages if not
; This checks formatting but not semantic correctness
```

### Test Caddy admin API for On-Demand TLS

```bash
# Check current config loaded in Caddy
curl http://localhost:2019/config 2>&1 | python3 -c "
import sys, json
data = json.load(sys.stdin)
# Look for tls configs with ask endpoints
apps = data.get('apps', [])
for app in apps:
    tls_config = app.get('tls', {})
    if tls_config.get('ask'):
        print(f'Domain: {app.get(\"server_name\", \"unknown\")}')
        print(f'  Ask endpoint: {tls_config[\"ask\"]}')
"

; Expected: Shows which domains have On-Demand TLS `ask` endpoints configured
```

### Test Caddy logging for On-Demand TLS events

```bash
# Check Caddy logs for On-Demand TLS activity
docker compose logs caddy 2>&1 | grep -i "tls\|certificate\|ask\|challenge"

; Expected: Shows Caddy TLS events, certificate management messages
; Look for: "skipping automatic certificate management", "enabling automatic HTTP->HTTPS redirects", etc.
```

### Verify Caddyfile formatting

```bash
# Format the Caddyfile (auto-fix any formatting issues)
caddy fmt --overwrite Caddyfile 2>&1

; Expected: "Running caddy fmt on Caddyfile" - makes config consistent
; Then: docker compose restart caddy to pick up the new config
```

### Test TLS is actually being served

```bash
# Full TLS test to verify HTTPS is working
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | grep -E "Protocol|Cipher|Verify"

; Expected: 
; Protocol  : TLSv1.3
; Cipher    : TLS_AES_128_GCM_SHA256
; verify return: OK
```

### Compare On-Demand vs pre-provisioned

```bash
# With local certs (proxy-learn approach):
; - Certs generated upfront
; - No `ask` endpoint needed
; - Works immediately

; With On-Demand TLS (conceptual):
; - Certs generated on first request
; - `ask` endpoint must return 2xx
; - Slight delay on first request
; - Certificates auto-renew like regular Let's Encrypt certs
```

---

## 5. In a real multi-tenant SaaS

### On-Demand TLS for SaaS custom domains (the full flow):

```caddyfile
# The complete On-Demand TLS flow for a SaaS platform
# Each merchant gets their own custom domain with automatic HTTPS

# Wildcard domain setup - Caddy will issue certs on demand
*.saasplatform.com {
  # The `ask` endpoint is the gatekeeper
  tls {
    # Caddy will call this before issuing any certificate
    ask http://my-tenant-portal/api/v1/domains/{domain}/verify
    
    # Expected response:
    # 200 OK with JSON: {"verified": true, "tenant_id": "abc-123"}
    #   → Caddy issues Let's Encrypt certificate
    # 403 Forbidden: {"verified": false}
    #   → Caddy returns 403, no certificate issued
    # 429 Too Many Requests: {"retry-after": 60}
    #   → Caddy respects rate limiting
  }
  
  # Route to the right tenant based on the Host header
  handle {
    route {
      # After On-Demand TLS issues the cert, route accordingly
      if {host} * "store-a.saasplatform.com" {
        reverse_proxy app-a:3000
        header {
          X-Tenant-Id "store-a"
          X-Forwarded-Proto "{scheme}"
        }
      }
      if {host} * "store-b.saasplatform.com" {
        reverse_proxy app-b:3000
        header {
          X-Tenant-Id "store-b"
          X-Forwarded-Proto "{scheme}"
        }
      }
      
      # Fallback
      response 404 "Tenant not found"
    }
  }
  
  # HSTS - once the cert is issued, force HTTPS
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
```

### The `ask` endpoint - critical security considerations:

```python
# SECURE `ask` endpoint example (Python/FastAPI)

from fastapi import FastAPI, HTTPRequest, HTTPException, Query
from slowapi import Limiter
from slowapi.util import get_remote_address

app = FastAPI()
limiter = Limiter(key=get_remote_address)
app.state.limiter = limiter

# Real tenant database (would be your SaaS's tenant registry)
TENANT_REGISTRY = {
    "store-a.saasplatform.com": {"tenant_id": "tenant-001", "verified": True},
    "store-b.saasplatform.com": {"tenant_id": "tenant-002", "verified": True},
    # ... more tenants
}

@app.get("/api/v1/domains/{domain}/verify")
@limiter.limit("10/minute")  # Rate limiting! Critical for abuse prevention.
def verify_domain(request: HTTPRequest, domain: str = Query(...)):
    """
    Verify that the domain belongs to a real tenant.
    MUST return 2xx if verified, 4xx if not.
    """
    
    # 1. Look up the domain in the tenant registry
    tenant = TENANT_REGISTRY.get(domain)
    
    if not tenant:
        # Domain not found - return 403
        # Caddy will NOT issue a certificate
        raise HTTPException(status_code=403, detail="Domain not authorized")
    
    if not tenant.get("verified", False):
        # Tenant exists but not verified (e.g., just signed up, awaiting approval)
        # Return 403 or 429 depending on your flow
        raise HTTPException(status_code=403, detail="Tenant not verified")
    
    # 2. Domain is verified - return 2xx
    # Caddy will issue the certificate and proceed with the request
    return {
        "domain": domain,
        "tenant_id": tenant["tenant_id"],
        "verified": True,
        "issued_at": "2026-01-01T00:00:00Z"  # optional: when cert was issued
    }
    
    # 3. Rate limiting is handled by the @limiter.decorator
    #    If rate limit exceeded, returns 429 Too Many Requests
    #    Caddy will retry later, not fail immediately
```

### On-Demand TLS rate limit protection:

**Why rate limiting the `ask` endpoint is critical**:

```text
Let's Encrypt rate limits (production):
- New certificates: 5 per domain per week
- Duplicate certificates: 5 per week  
- Accounts: 300 per IP

If the `ask` endpoint doesn't rate-limit:
- An attacker can trigger many first-requests
- Each request could get a new Let's Encrypt certificate
- Quickly exhaust the "5 per domain per week" limit
- Legitimate tenants then can't get their certificates
- Service denial for all tenants

Recommended `ask` endpoint rate limits:
- **Development/staging**: Very permissive (you're testing)
- **Production**: At least 10-20 requests per minute per IP
- **Aggressive protection**: 5 requests per minute per domain
- **IP-based**: Track by client IP address
- **Domain-based**: Track by requested domain name
```

### On-Demand TLS staging vs production:

```bash
# ALWAYS test On-Demand TLS in staging first!

# 1. Set Caddy to use Let's Encrypt staging environment
# In Caddyfile or Caddy JSON config:
tls {
    ask http://my-tenant-service/verify
    # Caddy will use staging by default when no cert exists
    # or set explicitly:
    # issuance dir ~/.caddy/staging
}

# 2. Test with made-up domains
; Expected behavior:
; - Request https://-fake-store.saasplatform.com/
; - Caddy calls the `ask` endpoint
; - If endpoint returns 200: Caddy gets STAGING cert (browser won't trust it, but works for testing)
; - If endpoint returns 403: Caddy returns 403, no cert
; - If endpoint returns 429: Caddy retries later

# 3. Only move to production after testing:
; - Verify the `ask` endpoint correctly authorizes real domains
; - Verify rate limiting works
; - Verify certificate issuance works in staging
; - Then switch to production (remove staging references)
```

### Revoking On-Demand TLS certificates:

```bash
# If a tenant leaves and you need to revoke their certificate:
sudo certbot revoke --certificate example.com

# Or via Caddy's admin API:
curl -X POST http://localhost:2019/certificates/revoke \
  -d '{"domains": ["store-a.saasplatform.com"]}'

# Or delete the certificate data:
; Caddy stores certs in its storage directory (usually ~/.caddy or /var/caddy)
; Remove the relevant cert files and restart Caddy
```

### Monitoring On-Demand TLS health:

```bash
# Check Caddy metrics (if Prometheus is enabled)
curl http://localhost:2019/metrics 2>&1 | grep -i "tls\|certificate\|requests"

; Expected: Metrics about TLS handshakes, certificate issuance, request counts

# Check Caddy health endpoint
curl http://localhost:2019/health 2>&1

; Expected: {"apid":"2013/..."} or similar health status

# Check for On-Demand TLS errors in logs
docker compose logs caddy 2>&1 | grep -i "tls\|ask\|certificate\|error"

; Expected: Shows any TLS-related errors or warnings
```

---

## 6. When to use it and when NOT to

**Use On-Demand TLS knowledge when**:
- Building a SaaS with custom domains per tenant
- Wanting automatic HTTPS without pre-provisioning certificates
- Each tenant needs their own valid HTTPS certificate
- Using Caddy as your reverse proxy
- Wanting to issue certificates only when first needed (optimization)

**NOT to skip `ask` endpoint verification**:

- Never deploy On-Demand TLS without a properly functioning `ask` endpoint
- Never skip rate limiting on the `ask` endpoint (abuse will kill your service)
- Never use the production Let's Encrypt environment without testing in staging first
- Never ignore the security implications of who can trigger certificate issuance

**NOT to use On-Demand TLS if**:
- You need certificates before tenants even sign up (use pre-provisioned certs instead)
- You have very few tenants (maybe 1-3) - just get certs upfront, simpler management
- You can't host an `ask` endpoint (then use wildcard certs or pre-provisioned certs)
- You're unwilling to accept the slight delay on first HTTPS request (though it's usually < 2 seconds)

---

## 7. Common mistakes

- **No rate limiting on `ask` endpoint**: Attackers can exhaust Let's Encrypt rate limits quickly, breaking HTTPS for all tenants
- **No domain validation in `ask` endpoint**: If the endpoint just returns 2xx for any domain, attackers can get HTTPS certs for any domain
- **Testing in production directly**: Always use Let's Encrypt staging first. Hitting production rate limits during testing can lock you out temporarily.
- **`ask` endpoint returns 200 for unrecognized domains**: Caddy will actually try to get a cert from Let's Encrypt, which will fail (or worse, succeed for a domain you don't own)
- **Forgetting that `ask` is per-domain, not per-tenant**: If tenant A's domain triggers cert issuance, that doesn't automatically authorize tenant B's domain
- **Not handling 429 (rate limit) from `ask`**: If the `ask` endpoint returns 429, Caddy will retry, but if it keeps failing, all HTTPS for that domain breaks
- **Ignoring the delay on first request**: The first HTTPS request to a new On-Demand TLS domain will be slower (cert issuance takes time, typically 2-10 seconds)
- **Using On-Demand TLS with DNS-01 without proper DNS provider config**: The `ask` endpoint handles tenant verification, but DNS-01 still needs your DNS provider configured in Caddy
- **Not cleaning up certificates when tenants leave**: Revoke certificates when tenants cancel to free up rate limit budget and maintain security

---

## 8. Try it yourself

**Exercise**: Understand On-Demand TLS concepts and the `ask` endpoint security model.

```bash
# 1. Check your current Caddy config (proxy-learn uses local certs, not On-Demand TLS)
cat /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile

; Expected: Shows local certs via `tls /path/cert /path/key`, no `ask` endpoint

# 2. Understand On-Demand TLS vs your current setup
; Your proxy-learn setup:
; - Local CA certificates (generated with openssl)
; - Certs valid for 1 year (you set the days)
; - No `ask` endpoint
; - Works immediately, no delay

; On-Demand TLS would be:
; - Certs issued by Let's Encrypt on first request
; - `ask` endpoint verifies domain ownership
; - Slight delay on first request (2-10 seconds)
; - Automatic renewal like regular Let's Encrypt certs

# 3. Test that local HTTPS works (what proxy-learn currently does)
curl -k -s https://app1.localhost/ | head -3

; Expected: HTML content from the app over HTTPS with local certs

# 4. Conceptual On-Demand TLS test (describe, don't actually run without real domains)
; In a real SaaS with real domains and an `ask` endpoint:
; 1. First request to https://new-tenant.example.com/
; 2. Caddy calls the `ask` endpoint: GET /verify?domain=new-tenant.example.com
; 3. If `ask` returns 200: Caddy gets Let's Encrypt cert, TLS handshake completes
; 4. If `ask` returns 403: Caddy returns 403, no certificate issued
; 5. If `ask` returns 429: Caddy retries later (rate limiting)

# 5. Verify Caddy supports On-Demand TLS
caddy version 2>&1 | head -1

; Expected: Caddy v2.x supports On-Demand TLS
; Your installed version should support it (Caddy has supported it since v2.4+)

# 6. Check Caddyfile syntax can support On-Demand TLS
caddy fmt --check Caddyfile 2>&1

; Expected: "OK" if your Caddyfile formatting is correct
; On-Demand TLS syntax: `tls { ask http://endpoint/verify }`
```

**Hint**: The key takeaway about On-Demand TLS:
- **It's powerful for SaaS** but **the `ask` endpoint is the security gate**
- **Without proper verification and rate limiting, it's a security vulnerability**
- **Always test in Let's Encrypt staging first** before going to production
- **Your proxy-learn setup uses local certs** - On-Demand TLS is a "future chapter" concept for when you have real domains

**Cleanup**: No cleanup needed - these commands only read existing configurations and understand the concepts.

---

## Next

[[08-nginx]] - Learn about Nginx: server blocks, `proxy_pass`, certbot, and a comparison with Caddy.