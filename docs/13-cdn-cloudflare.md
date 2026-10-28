# docs/13-cdn-cloudflare.md

## 1. Simple explanation (like I'm 7)

**CDN (Content Delivery Network)** is like having copies of your website stored in many different locations around the world. When someone visits your site, they get the copy from the location closest to them, rather than from one central server far away.

**Cloudflare** is a popular company that provides CDN services, security, and DNS management all in one.

### Proxied vs DNS-only mode:

- **Proxied (orange cloud)**: The CDN sits between the visitor and your site. It can cache content, add SSL, filter traffic, and hide your real server IP. The visitor sees the CDN's IP, not your server's IP.

- **DNS-only (gray cloud)**: The CDN just directs traffic to your server without caching or extra features. Your server's IP is exposed to the internet. Visitors connect directly to your server.

### SSL modes (important!):

- **Full**: Both the visitor and CDN use HTTPS, and CDN and your server use HTTPS. Requires valid HTTPS certificate on your server.
- **Full (strict)**: Like Full, but requires valid certificates (no self-signed). Your server's cert must be trusted by browsers.
- **Flexible**: HTTP between visitor and CDN, but HTTPS between CDN and your server. **DANGEROUS**: If CDN stops HTTPS, your traffic is unencrypted between CDN and server. Never use in production!
- **Off**: No HTTPS handling by CDN. Your server handles all SSL.

### Caching:

CDN caches static files (images, CSS, JavaScript) so they load faster. It's like having a photocopy machine at school instead of walking to the library every time.

---

## 2. Real name

**Cloudflare** is a web infrastructure and website security company providing Content Delivery Network (CDN) services, DDoS mitigation, Internet security, and distributed domain name server services.

**Key Cloudflare concepts**:

| Concept | Description |
|---------|-------------|
| **Proxied mode (orange cloud)** | CDN sits in front of your origin server; caches content, provides SSL, hides origin IP |
| **DNS-only mode (gray cloud)** | CDN only directs traffic; no caching or extra features; origin IP exposed |
| **SSL Full mode** | End-to-end HTTPS: visitor→CDN→origin all use HTTPS |
| **SSL Full (strict)** | Like Full, but requires valid, trusted certificates on origin |
| **SSL Flexible mode** | HTTP visitor→CDN, HTTPS CDN→origin. **DANGEROUS**: unencrypted segment |
| **SSL Off mode** | CDN doesn't handle SSL; origin handles all encryption |
| **Cache TTL** | How long content is cached before checking for updates |
| **Page Rules** | Custom behavior for specific URL patterns |
| **SSL Origin CA** | Cloudflare-provided tool to generate origin certificates |
| **CNAME Flattening** | Allows CNAME records at root domain (like ALIAS/ANAME) |

**How Cloudflare fits in your architecture**:

```text
+---------------------+      +----------------------+      +----------------------+
|   Visitor's Browser |      |   Cloudflare CDN     |      |   Your Origin Server |
+----------+----------+      +----------+-----------+      +----------+-----------+
           |                           |                            |
           |  HTTPS (if proxied)       |  HTTPS (if Full/Strict)  |
           |                           |                            |
           |  Cached content?          |  Forward to origin?        |
           |  (yes if proxied)         |  (yes if not cached)       |
           |                           |                            |
           v                           v                            v
+----------------------+  +----------------------+  +----------------------+
|  Cloudflare Edge     |  |  Request routed to   |  |  Your Node.js App   |
|  (closest to user)   |  |  Your Server IP     |  |  (behind proxy)     |
+----------------------+  +----------------------+  +----------------------+
```

---

## 3. Config example

### Cloudflare DNS settings for custom domains

```text
; When adding a merchant's custom domain to Cloudflare:

; 1. Add the domain to Cloudflare
; 2. Choose mode:

; Option A: Proxied (orange cloud icon)
;   - Type: CNAME or A record
;   - Name: store (subdomain) or @ (root)
;   - Value/Target: proxy.your-saas.com (your Caddy/Nginx server)
;   - Proxy status: ORANGE (proxied)
;   - Benefits: Caching, SSL, IP hiding, DDoS protection
;   - TTL: Auto (default 1)

; Option B: DNS-only (gray cloud icon)
;   - Type: CNAME or A record
;   - Name: store or @
;   - Value/Target: proxy.your-saas.com
;   - Proxy status: GRAY (DNS-only)
;   - Benefits: No caching, origin IP exposed, simple
;   - TTL: Auto (default 1)
```

### Cloudflare SSL mode configuration

```text
; In Cloudflare dashboard, for each domain:

; Option 1: Full SSL (recommended)
;   - Setting: Full
;   - Visitor connection: HTTPS
;   - Cloudflare → Origin: HTTPS
;   - Requirement: Valid HTTPS cert on your origin server
;   - Your Caddy/Nginx must have a working certificate

; Option 2: Full (strict) SSL
;   - Setting: Full (strict)
;   - Visitor connection: HTTPS
;   - Cloudflare → Origin: HTTPS
;   - Requirement: Valid, trusted certificate on origin
;   - Certificate must validate against public CA (Let's Encrypt, DigiCert, etc.)
;   - No self-signed certs allowed

; Option 3: Flexible SSL (DANGEROUS - never use in production!)
;   - Setting: Flexible
;   - Visitor connection: HTTP (unencrypted!)
;   - Cloudflare → Origin: HTTPS
;   - RISK: Traffic is unencrypted between visitor and Cloudflare!
;   - If Cloudflare drops HTTPS support, data is exposed
;   - NEVER use for SaaS with custom domains or sensitive data

; Option 4: Off SSL
;   - Setting: Off
;   - Visitor connection: HTTP
;   - Cloudflare → Origin: HTTP
;   - No SSL handling by Cloudflare
;   - Your server handles all SSL/TLS
```

### Nginx configuration when behind Cloudflare

```nginx
# When your origin server (Nginx) is behind Cloudflare,

; you must trust Cloudflare's IP addresses so Nginx uses
; the real visitor IP from Cloudflare headers instead of
; the Cloudflare proxy IP.

# 1. Set up trusted proxy IP ranges
set_real_ip_from 173.245.48.0/22;     # Cloudflare IPv4
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/24;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 188.114.96.0/22;
set_real_ip_from 198.41.124.0/22;
set_real_ip_from 2400:cb00::/32;       # Cloudflare IPv6
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f5c0::/32;
set_real_ip_from 2803:f6c0::/32;
set_real_ip_from 2c0f:f248::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f250::/32;

; 2. Use the CF-Connecting-IP header as the real IP
real_ip_header CF-Connecting-IP;

server {
    listen 80;
    server_name store.example.com;
    
    # Now $remote_addr will be the real visitor's IP,
    ; not the Cloudflare proxy IP
    
    location / {
        proxy_pass http://app:3000;
        
        # Forwarded headers (but Cloudflare already set CF-Connecting-IP)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;  ; # Will be real IP from set_real_ip_module
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy configuration when behind Cloudflare

```caddyfile
# When Caddy is behind Cloudflare (proxied mode),

; Caddy automatically trusts Cloudflare and uses
; the CF-Connecting-IP header for the real client IP.

; No special config needed - Caddy's default behavior
; when running behind a trusted reverse proxy (Cloudflare)
; is to read CF-Connecting-IP.

app1.localhost {
  # If Caddy is behind Cloudflare proxied:
  # - X-Forwarded-For will contain Cloudflare IPs
  # - Caddy can be configured to trust them
  
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  reverse_proxy app:3000
  
  # Optionally, explicitly trust Cloudflare:
  # header Upstream-Addr {remote}
}
```

### Page Rules / Redirect rules in Cloudflare

```text
; Cloudflare Page Rules (now called "Rules") for custom domains:

; Example Page Rules for SaaS:

; 1. Force HTTPS for custom domain
;   - If not already handled by Caddy/Nginx
;   - Rule: "If URL matches store.example.com/*"
;   - Action: Forward HTTPS, Always Use HTTPS

; 2. WWW to non-www redirect
;   - Rule: "If URL matches www.store.example.com/*"
;   - Action: Redirect to https://store.example.com/$request_uri, 301

; 3. Cache everything for 6 hours
;   - Rule: "If URL matches store.example.com/static/*"
;   - Action: Cache TTL 6 hours, Level: Standard

; 4. Bot management
;   - Rule: "If URL matches store.example.com/api/*"
;   - Action: Challenge captcha, rate limit, or block
```

### Cloudflare caching control

```text
; Control what Cloudflare caches for your SaaS custom domains:

; 1. Cache Level settings:
;   - Standard: Cache HTML, CSS, JS, images
;   - Aggressive: Cache everything including no-store responses (use with caution)
;   - Bypass: Don't cache, always go to origin

; 2. Cache TTL (Time to Live):
;   - Browser TTL: How long browser caches the response
;   - Edge TTL: How long Cloudflare edge caches it
;   - Example: 3600 (1 hour), 86400 (1 day), auto

; 3. Cache key:
;   - Default: hostname + path + query string
;   - Custom: Can include headers, cookies for personalized content

; 4. Surpass Cache Control:
;   - Responses with Cache-Control: no-store are not cached by default
;   - Can be overridden with "Cache all" setting (not recommended for sensitive data)
```

---

## 4. Commands and what you should test

### Test Cloudflare proxy mode concept (no actual Cloudflare account needed)

```bash
; In proxy-learn, we can't test actual Cloudflare, but you can understand the concepts:

; 1. Proxied mode (orange cloud):
;    - CDN sits between visitor and origin
;    - Hides origin IP (172.23.0.1 in proxy-learn)
;    - Caches content
;    - Provides SSL
;    - Conceptual: "internet → Cloudflare → your proxy"

; 2. DNS-only mode (gray cloud):
;    - CDN just directs traffic
;    - No caching features
;    - Origin IP (172.23.0.1) is exposed to internet
;    - Conceptual: "internet → your proxy directly"

; 3. Compare the setups:

echo "=== Proxied mode benefits ==="
echo "• Caching speeds up repeat visits"
echo "• SSL handled by Cloudflare"
echo "• Origin IP hidden (more secure)"
echo "• DDoS protection"
echo ""
echo "=== DNS-only mode benefits ==="
echo "• No caching (content always fresh)"
echo "• Origin IP exposed (good for some setups)"
echo "• Simpler, no CDN config needed"
echo "• Useful when you manage SSL yourself"
```

### Test SSL mode understanding

```bash
; Understand the SSL modes (conceptual, no actual Cloudflare needed)

; Flexible SSL (DANGEROUS - never use):
;   Visitor → Cloudflare: HTTP (unencrypted)
;   Cloudflare → Origin: HTTPS (encrypted)
;   RISK: Data exposed between visitor and Cloudflare

; Full SSL (recommended):
;   Visitor → Cloudflare: HTTPS (encrypted)
;   Cloudflare → Origin: HTTPS (encrypted)
;   Both segments encrypted

; Full (strict) SSL:
;   Like Full, but cert must be valid and publicly trusted
;   No self-signed or local certs (unless added to trusted root)

; In proxy-learn, we use local certs, which would be:
; "Full" mode if Cloudflare were configured
; But "Full (strict)" would NOT work with our local CA certs
; unless we added our CA to Cloudflare's trusted authorities
```

### Test Nginx with Cloudflare IP trust (conceptual)

```bash
; The key test is whether Nginx uses the real visitor IP

; Without set_real_ip_from (Cloudflare IP ranges):
; $remote_addr = Cloudflare proxy IP (173.245.48.x etc.)

; With set_real_ip_from and real_ip_header:
; $remote_addr = Real visitor's IP (what the app sees)

; In proxy-learn, we're not behind Cloudflare, so:
; The app sees 172.23.0.1 (Docker bridge network IP)

; If behind Cloudflare, you'd need:
; 1. Get Cloudflare's IP ranges (from cloudflare.com ips)
; 2. Add set_real_ip_from directives
; 3. Add real_ip_header CF-Connecting-IP
; 4. Verify $remote_addr changes from Cloudflare IP to real IP
```

### Test caching concepts

```bash
; Caching test concept

; Without CDN (proxy-learn):
; - Every request goes to the app
; - Response time: ~100ms-500ms (depends on app)

; With CDN (Cloudflare proxied):
; - First request: goes to origin, gets 200 + caches
;   Response header: "X-Cache: MISS"
; - Subsequent requests: served from Cloudflare edge
;   Response header: "X-Cache: HIT"
;   - Much faster (10-50ms)

; In proxy-learn, we can't test actual Cloudflare caching,
; but understand the concept:
; - X-Cache: HIT = cached, MISS = not cached, EXPIRED = stale but served

; Test the headers concept (conceptual):
echo "Without CDN (expected - no X-Cache):"
curl -I http://localhost:8080/ 2>&1 | grep -i "x-cache" || echo "No X-Cache header"

; With Cloudflare proxied (expected - would show X-Cache):
; - First request: X-Cache: MISS
; - Second request: X-Cache: HIT
```

### Test domain propagation and TTL

```bash
; Understanding TTL and propagation (conceptual)

; Low TTL (recommended for SaaS custom domains):
;  - TTL: 300 seconds (5 minutes)
;  - Changes propagate in 5-10 minutes
;  - Good for when merchants frequently change DNS

; High TTL:
;  - TTL: 86400 seconds (24 hours)
;  - Changes take up to 24 hours to propagate
;  - Good for stable domains that don't change

; In proxy-learn (/etc/hosts):
; - TTL is 0 (immediate)
; - No propagation delay
; - Real DNS: depends on domain registrar and TTL setting

; Test concept:
; "If a merchant changes their DNS CNAME record:
;  1. Set TTL to 300 for quick propagation
;  2. Wait 5-10 minutes
;  3. Verify with dig/nslookup
;  4. Then proceed with HTTPS setup"

; Your proxy-learn test:
; - dig store1.example.com +short  ; Shows 127.0.0.1 immediately
; - No propagation waiting needed!
```

### Test Cloudflare SSL mode comparison

```bash
; SSL Mode comparison table (conceptual)

; Mode            Visitor→Cloudflare  Cloudflare→Origin  Security
; ------          ------------------  -----------------  --------
; Flexible        HTTP                HTTPS              ⚠️  Risky (one segment HTTP)
; Full            HTTPS               HTTPS              ✅  Good (both encrypted)
; Full (strict)   HTTPS               HTTPS + valid cert ✅  Best (both encrypted + valid cert)
; Off             HTTP                HTTP               ❌  No SSL by Cloudflare

; In proxy-learn with local certs:
; - If Cloudflare were proxied with "Full": would work
; - If Cloudflare were proxied with "Full (strict)": would FAIL
;   (our local CA certs aren't publicly trusted)
; - "Flexible": would technically work but is ⚠️ dangerous
; - "Off": would work but no Cloudflare SSL handling
```

### Test the difference between proxied and DNS-only

```bash
; Conceptual test of the two modes

; Proxied mode (orange cloud in Cloudflare):
;   Internet → Cloudflare Edge → Your Origin Server
;   - Cloudflare sees the real request
;   - Your server sees Cloudflare's IP
;   - Caching, SSL, filtering all happen at Cloudflare
;   - Origin IP is hidden (merchants can't easily DDoS you)
;   - Best for: Most SaaS, production websites

; DNS-only mode (gray cloud in Cloudflare):
;   Internet → Your Origin Server (directly)
;   - No Cloudflare caching
;   - Your server sees the real visitor IP
;   - No DDoS protection from Cloudflare
;   - Origin IP is exposed
;   - Best for: When you need direct access, or Cloudflare features aren't needed
```

---

## 5. In a real multi-tenant SaaS

### Cloudflare setup for SaaS custom domains:

```text
; When onboarding a merchant with a custom domain:

; 1. Merchant adds domain to SaaS dashboard
; 2. SaaS adds domain to Cloudflare (if using Cloudflare)
; 3. Choose proxy mode:
;    - Proxied (orange cloud): For HTTPS, caching, IP hiding
;    - DNS-only (gray cloud): If you manage SSL/CDN separately

; 4. Configure SSL mode:
;    - Full (recommended): Both segments HTTPS
;    - Requires: Valid cert on your origin (Caddy auto-gets Let's Encrypt)
;    - Or: Full (strict) if cert is publicly trusted

; 5. Set caching rules:
;    - Cache static assets (images, CSS, JS)
;    - Don't cache sensitive API responses
;    - Set appropriate TTL (5 min - 24 hours)

; 6. Configure Page Rules / Rules:
;    - Force HTTPS
;    - WWW to non-www redirect
;    - Cache level per URL pattern
;    - Bot protection

; 7. Merchant configures DNS at registrar:
;    - CNAME record pointing to your proxy domain
;    - Choose proxy mode in Cloudflare
;    - Wait for DNS propagation

; 8. HTTPS activates (Caddy auto-gets Let's Encrypt cert)
; 9. Merchant's custom domain is live!
```

### Caddy + Cloudflare integration:

```caddyfile
# Caddy behind Cloudflare (proxied mode)

; When Caddy is behind Cloudflare's proxied DNS:

; Caddy automatically handles the transition:
; - Cloudflare terminates HTTPS from visitor
; - Cloudflare forwards HTTP to Caddy (or HTTPS if Full mode)
; - Caddy terminates the second HTTPS hop to the browser
;   if using "Full" mode, or just handles the request

; If Cloudflare is "Full" mode:
; - Visitor → Cloudflare: HTTPS (Cloudflare cert)
; - Cloudflare → Caddy: HTTPS (your Caddy cert)
; - Caddy serves the content

; If Cloudflare is "DNS-only":
; - Cloudflare just directs traffic
; - Caddy handles all HTTPS directly
; - No Cloudflare intermediate

; No special Caddy config needed for basic Cloudflare integration:
; Caddy detects the proxy and adjusts accordingly.

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  reverse_proxy app:3000
}
```

### Per-tenant caching with Cloudflare:

```caddyfile
# SaaS custom domain with Cloudflare caching

store-a.example.com {
  # Caddy reverse proxy to app
  reverse_proxy app-a:3000
  
  # Cloudflare will cache based on:
  ; - Cache Level setting in Cloudflare dashboard
  ; - Cache TTL setting
  ; - Cache-Control headers from your app
  
; Caddy can set cache control headers:
; header {
;   Cache-Control "public, max-age=3600"
; }
  
; Cloudflare respects these and caches accordingly.
}
```

### Cloudflare Page Rules for SaaS:

```text
; Common Page Rules for SaaS custom domains:

; 1. Force HTTPS everywhere
;   URL pattern: "store.example.com/*"
;   Settings: "Always Use HTTPS", "HSTS"
;   Priority: High

; 2. WWW redirect
;   URL pattern: "www.store.example.com/*"
;   Settings: "Redirect to https://store.example.com/$request_uri", "301"
;   Priority: Medium

; 3. Cache API responses (short TTL)
;   URL pattern: "store.example.com/api/*"
;   Settings: "Cache TTL", "1 hour"
;   Priority: Low

; 4. Bypass cache for admin paths
;   URL pattern: "store.example.com/admin/*"
;   Settings: "Cache Level", "Bypass"
;   Priority: High

; 5. Bot challenge
;   URL pattern: "store.example.com/*"
;   Settings: "Security Level", "I'm Under Attack!" (for DDoS protection)
```

### SSL certificate management with Cloudflare + Let's Encrypt:

```text
; When using Cloudflare + Let's Encrypt + Caddy:

; 1. Caddy handles Let's Encrypt HTTP-01 challenge
;    - Cloudflare proxied: Caddy can reach port 80 internally
;    - Cloudflare DNS-only: Use DNS-01 challenge with Cloudflare API
;    - Or: Pre-provision certificates

; 2. Caddy automatically renews before expiration
;    - 30-day warning before expiry
;    - Automatic renewal in staging first, then production

; 3. Certificate storage:
;    - Caddy stores certs in /root/.caddy/
;    - Can integrate with Cloudflare API for DNS-01 challenges
;    - Or use HTTP-01 if port 80 is accessible

; 4. For SaaS custom domains:
;    - Caddy gets a separate cert for each domain
;    - store-a.example.com → cert-a
;    - store-b.example.com → cert-b
;    - All auto-managed via Let's Encrypt

; 4. Cloudflare Full SSL mode:
;    - Visitor → Cloudflare: Cloudflare-managed cert (free)
;    - Cloudflare → Caddy: Your Caddy-managed Let's Encrypt cert
;    - Both segments have valid HTTPS
```

### Migrating from DNS-only to Proxied mode:

```text
; When onboarding a new merchant and switching from DNS-only to Proxied:

; Step 1: Merchant adds domain to Cloudflare with DNS-only (gray cloud)
; Step 2: Verify domain resolves and works via DNS-only mode
; Step 2: In Cloudflare, change to Proxied (orange cloud)
; Step 3: Wait for DNS propagation (TTL dependent, typically a few minutes)
; Step 4: Test HTTPS - should now work with Cloudflare SSL
; Step 5: Cloudflare handles visitor-facing SSL
; Step 6: Your origin (Caddy/Nginx) still terminates the second HTTPS hop
; Step 7: All traffic benefits from Cloudflare caching and DDoS protection

; Important: If using "Full" SSL mode, ensure your origin has valid HTTPS
; If using "Flexible" SSL mode, do NOT switch - it's dangerous and will break
```

---

## 6. When to use it and when NOT to

**Use Cloudflare/CDN knowledge when**:
- You want to add caching to speed up your SaaS
- You want to hide your origin server IP for security
- You need DDoS protection
- You want free SSL/TLS certificates via Let's Encrypt integration
- You need WAF (Web Application Firewall) rules
- You want global edge network for faster content delivery

**NOT to use Cloudflare if**:
- You need real-time communication (WebSockets) with low latency - Cloudflare's caching can interfere
- You need full control over every HTTP header (Cloudflare may modify some)
- You're uncomfortable with a third party sitting between your users and your server
- You need "Flexible" SSL mode (dangerous, never use!)
- Your SaaS requires requests to go directly to your origin without intermediaries
- You're in a region where Cloudflare is blocked or restricted

**NOT to use "Flexible" SSL mode**:
- "Flexible" encrypts only one segment (Cloudflare→origin)
- The other segment (visitor→Cloudflare) is UNENCRYPTED (HTTP)
- **Never use for SaaS with custom domains or any production deployment**
- Always use "Full" or "Full (strict)" instead
- If you don't have HTTPS on your origin, get Let's Encrypt certs first, then use Cloudflare

---

## 7. Common mistakes

- **Using Flexible SSL mode**: The #1 mistake. Unencrypted segment between visitor and Cloudflare. Always use Full or Full (strict).
- **Not updating nameservers when adding domain to Cloudflare**: Cloudflare can't manage DNS if the domain's nameservers still point elsewhere.
- **Forgetting to update Nameservers**: The #2 mistake. Without updating NS records, Cloudflare can't manage the domain.
- **Proxied mode without HTTPS on origin**: If Cloudflare is proxied but your origin doesn't have HTTPS, "Full" mode won't work. Get Let's Encrypt certs first.
- **Not excluding admin paths from caching**: Admin dashboard pages should not be cached. Use Cache Level: Bypass or appropriate Page Rules.
- **Using too aggressive cache TTL**: 24-48 hour TTL on frequently changed content means users see stale data. Use shorter TTL (5 min - 2 hours) for dynamic SaaS content.
- **Not setting up Page Rules for www ↔ non-www**: Inconsistent domain handling can cause SEO issues and user confusion.
- **Not adding Cloudflare IP ranges to trusted proxies**: If behind Cloudflare, Nginx (and potentially Caddy) won't recognize Cloudflare IPs and will use the proxy IP instead of real visitor IP.
- **Forgetting Cloudflare modifies some headers**: Cloudflare adds `CF-RAY`, `CF-Connecting-IP`, and may modify `User-Agent`. Your app should handle or ignore these appropriately.
- **Using Cloudflare for WebSocket heavy applications**: Cloudflare's caching and optimization can interfere with real-time WebSocket connections. Use "WS" companion proxy or direct connections for WebSocket-reliant features.

---

## 8. Try it yourself

**Exercise**: Test CDN and Cloudflare concepts.

```bash
# 1. Test the difference between proxied and DNS-mode concepts
echo "=== Proxied vs DNS-only comparison ==="
echo "Proxied (orange cloud): CDN sits between visitor and origin"
echo "  • Caches content"
echo "  • Provides SSL"
echo "  • Hides origin IP"
echo "  • DDoS protection"
echo ""
echo "DNS-only (gray cloud): CDN just directs traffic"
echo "  • No caching features"
echo "  • Origin IP exposed to internet"
echo "  • Direct connection to your server"
echo ""
echo "In proxy-learn, we can't test actual Cloudflare, but understand:"
echo "• Your proxy IP (172.23.0.1) is like the 'origin IP'"
echo "• Proxied mode would 'hide' this from visitors"
echo "• DNS-only mode would expose it"

# 2. Test SSL mode understanding
echo ""
echo "=== SSL Modes ==="
echo "Flexible: Visitor→Cloudflare HTTP, Cloudflare→Origin HTTPS"
echo "  ⚠️  DANGEROUS - never use in production!"
echo ""
echo "Full: Visitor→Cloudflare HTTPS, Cloudflare→Origin HTTPS"
echo "  ✅  Recommended for most setups"
echo ""
echo "Full (strict): Like Full, but cert must be publicly trusted"
echo "  ✅  Best security, but may not work with local CA certs"
echo ""
echo "In proxy-learn with local CA certs:"
echo "• 'Full' would work if Cloudflare configs allowed local certs"
echo "• 'Full (strict)' would FAIL (local certs not publicly trusted)"
echo "• 'Flexible' would technically work but ⚠️ dangerous"

# 3. Test caching concept (no actual Cloudflare)
echo ""
echo "=== Caching headers concept ==="
echo "Without CDN (proxy-learn direct):"
curl -I http://localhost:8080/ 2>&1 | grep -i "^x-" || echo "No special cache headers"

echo ""
echo "With Cloudflare proxied (expected headers):"
echo "- First request: X-Cache: MISS (origin served it)"
echo "- Second request: X-Cache: HIT (edge served it, faster)"
echo "- Configurable via Cloudflare dashboard"

# 4. Test domain resolution
echo ""
echo "=== Domain resolution ==="
echo "dig app1.localhost +short  (from /etc/hosts, immediate)"
dig app1.localhost +short

echo ""
echo "This is what would happen with real DNS + Cloudflare:"
echo "• Merchant adds CNAME to Cloudflare"
echo "• Cloudflare manages the DNS"
echo "• Proxy IP is hidden or exposed based on proxy mode"

# 5. Compare your current setup features
echo ""
echo "=== Current proxy-learn features ==="
echo "• Node.js app on port 3000"
echo "• Caddy reverse proxy with local HTTPS"
echo "• Nginx comparison reverse proxy (HTTP)"
echo "• /etc/hosts for DNS (immediate, no propagation)"
echo "• No Cloudflare CDN (could be added later)"
echo "• Manual certificate management (local CA)"
echo "• Could add Cloudflare for: caching, IP hiding, DDoS protection"

# 6. Clean up test /etc/hosts entries if added
echo ""
echo "=== Cleanup ==="
; sed -i '/store1.example.com/d' /etc/hosts 2>/dev/null
; sed -i '/store2.example.com/d' /etc/hosts 2>/dev/null
; echo "/etc/hosts cleaned up (or was already clean)"

; Cleanup note: The test entries were already removed above.
; In a real scenario, merchants would add their own domains to Cloudflare or their DNS provider.
```

**Hint**: Key takeaways about Cloudflare and CDNs:

| Feature | Proxied (Orange Cloud) | DNS-Only (Gray Cloud) |
|---------|----------------------|----------------------|
| **Caching** | Yes, content cached at edge | No |
| **SSL/TLS** | Handles HTTPS (Full mode) | No (origin handles all SSL) |
| **Origin IP** | Hidden (more secure) | Exposed |
| **DDoS protection** | Yes, Cloudflare filters traffic | No |
| **Configuration** | DNS + Cloudflare dashboard | Just DNS records |
| **Best use case** | Most SaaS, production websites | When you need direct origin access |
| **Flexible SSL** | ⚠️  DANGEROUS - NEVER USE | N/A |

**Cleanup**: No actual cleanup needed for /etc/hosts (the test sed commands are commented out to avoid breaking your setup).

---

## Next

[[14-security]] - Learn about firewall basics, subdomain takeover, dangling DNS records, and host header injection.