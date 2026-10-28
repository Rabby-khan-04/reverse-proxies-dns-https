# docs/14-security.md

## 1. Simple explanation (like I'm 7)

**Security** for your website and SaaS is like locking your doors and windows. You want to keep bad people out and make sure only the right people get in.

### Key security concepts:

- **Firewall**: Like a security guard at the door. Only lets approved people/information in.
- **Subdomain takeover**: When you delete a page but forget to delete the DNS record. Bad people can claim that subdomain and put their content there.
- **Dangling DNS**: Similar - DNS points to somewhere that no longer exists, and bad people can take over.
- **Host header injection**: When someone tricks the server into thinking the request came from a different domain. Can allow attacking other users.

### What you'll learn:
- How to firewall your setup
- How to prevent subdomain takeovers
- How to detect and prevent host header injection
- How to configure your firewall properly

---

## 2. Real name

**Security** in the context of web applications and reverse proxies encompasses multiple layers:

| Layer | What it protects | How |
|-------|-----------------|-----|
| **Network firewall** | Unauthorized access to ports/services | Rules allowing only necessary ports (e.g., 80/443, blocking 3000) |
| **Web application firewall (WAF)** | SQL injection, XSS, malicious requests | Rules to filter bad traffic |
| **DNS security** | DNS hijacking, subdomain takeovers | Proper DNS config, monitoring, CAA records |
| **Header security** | Request forgery, domain spoofing | Proper Host header handling, trusted proxy config |
| **TLS/HTTPS** | Eavesdropping, data theft | Encryption, certificate validation, HSTS |
| **Rate limiting** | Abuse, DDoS, resource exhaustion | Request rate limits per IP/domain |

**Subdomain takeover** occurs when:
1. You have a CNAME record pointing to a service (e.g., `store.example.com → herokuapp.com`)
2. You delete the application from that service
3. The CNAME record still exists, pointing to the now-unavailable service
4. Bad people can create a new app on that service and get the subdomain
5. They can then serve content at `store.example.com`, making it look like yours

**Host header injection** occurs when:
1. The proxy doesn't properly validate the Host header
2. The backend uses the Host header for authentication/authorization
3. An attacker sends a request with a forged Host header
4. The backend authorizes the request based on the fake domain
5. The attacker gains access or performs actions as another user

---

## 3. Config example

### Firewall basics (using ufw as example - conceptual)

```bash
; Allow only necessary ports (80 HTTP, 443 HTTPS)
; Block everything else

; ufw (Uncomplicated Firewall) examples:
; ufw allow 80/tcp   # Allow HTTP
; ufw allow 443/tcp  # Allow HTTPS
; ufw default deny   # Deny everything else

; In proxy-learn Docker context, we use Docker networking:
; - Ports 80/443 are exposed to the host (for Caddy/Nginx)
; - Port 3000 (Node.js app) is NOT exposed to the internet
; - Only accessible within the Docker network
; - Firewall at host level should block port 3000 from outside Docker

; iptables (low-level) examples:
; iptables -A INPUT -p tcp --dport 80 -j ACCEPT   # Allow HTTP
; iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # Allow HTTPS
; iptables -A INPUT -p tcp --dport 3000 -j DROP   # Block port 3000
; iptables -A INPUT -j DROP                       # Drop everything else
```

### Preventing subdomain takeover

```caddyfile
; Caddy config with subdomain takeover monitoring

; In your SaaS, monitor for dangling CNAME records

; Example: If you have a CNAME for a merchant's custom domain
; that points to an external service (e.g., Heroku, GitHub Pages):

; 1. Ensure the external service is still active
; 2. If the service is deleted, remove the CNAME record immediately
; 3. Caddy will show certificate errors if HTTPS is configured
;    for a domain that's been taken over

; Caddy config example with monitoring:

; store-a.example.com {
;   # Caddy will attempt to get a cert for this domain
;   # If the CNAME is dangling, Let's Encrypt/DNS-01 will fail
;   tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
;   
;   # If cert issuance fails, investigate immediately!
;   # Don't ignore "certificate issuance failed" errors
;   
;   reverse_proxy app-a:3000
; }
```

### Nginx with subdomain takeover protection

```nginx
; Nginx config with careful server_name handling

server {
    listen 80;
    server_name store-a.example.com;
    
    # Only respond to explicitly configured server names
    ; Don't use wildcard server_name that could catch dangling subdomains
    
    location / {
        proxy_pass http://app-a:3000;
    }
    
    # Log any requests to unknown subdomains
    access_log /var/log/nginx/subdomain-takeover.log;
}
```

### Host header injection prevention

```caddyfile
; Caddy config with Host header validation

; Only trust Host headers from known, expected domains

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  reverse_proxy app:3000
  
  # Caddy automatically passes the Host header
  # Prevention: Ensure the backend validates the Host header
  # against expected tenant domains
  
  # Example backend code (Node.js Express):
  ; app.use((req, res, next) => {
  ;   const allowedDomains = ['app1.localhost', 'app2.localhost'];
  ;   const host = req.get('Host');
  ;   if (!allowedDomains.includes(host)) {
  ;     return res.status(403).send('Unauthorized domain');
  ;   }
  ;   next();
  ; });
}

; Nginx with Host header validation

server {
    listen 80;
    server_name app1.localhost app2.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # Nginx can also check Host header
        # But typically this is done at the application level
    }
    
    # Reject requests with unexpected Host headers
    # This is typically application-level logic
}
```

### Firewall configuration for proxy-learn

```bash
; Host-level firewall rules (what we have in proxy-learn environment)
; These protect the server itself

; Allow only ports 80 and 443 from the internet
; (These are the Caddy/Nginx ports)

; Block port 3000 (Node.js app) from internet access
; The app is only accessible within the Docker network

; Example iptables rules:
; iptables -A INPUT -p tcp --dport 80 -j ACCEPT
; iptables -A INPUT -p tcp --dport 443 -j ACCEPT
; iptables -A INPUT -p tcp --dport 3000 -j DROP   # CRITICAL: block app port
; iptables -A INPUT -s 127.0.0.1/32 -j ACCEPT   # Allow localhost
; iptables -A INPUT -s 172.23.0.0/16 -j ACCEPT  # Allow Docker network
; iptables -A INPUT -j DROP                       # Drop all other traffic

; Example ufw rules:
; ufw allow 80/tcp
; ufw allow 443/tcp
; ufw default deny incoming
; ufw default allow outgoing
```

### Caddy security headers (automatic)

```caddyfile
; Caddy automatically adds these security headers:

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  reverse_proxy app:3000
  
  # Caddy automatically adds these response headers:
  header {
    X-Content-Type-Options "nosniff"     # Prevent MIME-type sniffing
    X-Frame-Options "DENY"              # Prevent clickjacking (page can't be framed)
    Referrer-Policy "strict-origin-when-origin-only"  # Control referrer info
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"  # HSTS
  }
}
```

### Nginx security headers

```nginx
; Nginx security headers configuration

server {
    listen 443 ssl;
    server_name store-a.example.com;
    
    # SSL config...
    
    # Add security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-origin-only" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

---

## 4. Commands and what you should test

### Test firewall rules (conceptual - proxy-learn environment)

```bash
; Check current firewall rules (if any)
; In Docker environment, check with:
iptables -L INPUT -n 2>&1 | head -20

; Expected: Shows the INPUT chain rules
; Should include ACCEPT for ports 80/443, DROP for port 3000

; Or with ufw (if installed):
; ufw status verbose

; Expected: Shows firewall status and rules
```

### Test that port 3000 is not externally accessible

```bash
; The Node.js app should only be accessible within Docker network
; Not from the host machine directly (unless you've exposed it)

; Test from host (should fail or connect to Docker gateway, not the app):
curl -v http://localhost:3000/ 2>&1 | head -5

; Expected: Connection refused or proxy error (port 3000 not exposed)

; Test from within Docker network (should work):
; Conceptual - would use docker network inspect

; In proxy-learn, port 3000 is NOT mapped to host in a way that allows
; direct external access - it's only reachable via Caddy/Nginx reverse proxy
```

### Test subdomain takeover risk awareness

```bash
; Conceptual test - understand the risk, don't actually test takeovers

; 1. List all your CNAME records (in real DNS, not /etc/hosts)
; 2. For each CNAME, verify the target service still exists
; 3. If target was deleted, remove the CNAME record immediately
; 4. If CNAME remains after service deletion, it's a takeover risk

; In proxy-learn, we use /etc/hosts (no CNAME records), so:
; - No CNAME records = no subdomain takeover risk from CNAMEs
; - But still good practice to monitor DNS records

; Test the concept:
echo "=== Subdomain takeover risk check ==="
echo "In real DNS: List all CNAME records for your domains"
echo "Verify each target still exists"
echo "Remove CNAMEs for deleted services immediately"
echo ""
echo "In proxy-learn (/etc/hosts):"
echo "• No CNAME records = lower risk"
echo "• Still monitor for any added DNS records"
echo "• Keep /etc/hosts clean and documented"
```

### Test Host header injection prevention

```bash
; Test that the app properly validates the Host header

; In your Express app (already configured):
; The app should only accept expected Host headers

; Test with valid Host header:
curl -k -s https://app1.localhost/ | head -3

; Expected: Works fine, shows app content

; Test with unexpected Host header (if your app validates):
curl -k -s https://app1.localhost/ -H "Host: evil-domain.com" 2>/dev/null | head -3

; Expected: Depending on app config, may return 403 or app content
; Good apps will reject unknown Host headers

; Test with the headers endpoint:
curl -k https://app1.localhost/headers 2>/dev/null | grep "Host"

; Expected: Shows the Host header value the app sees
```

### Test security headers

```bash
; Test that security headers are present

echo "=== Caddy security headers ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -E "X-Content|X-Frame|X-Fer"

echo ""
echo "Expected headers present:"
echo "• X-Content-Type-Options: nosniff"
echo "• X-Frame-Options: DENY"
echo "• Referrer-Policy: strict-origin-when-origin-only"
echo "• Strict-Transport-Security: max-age=..."

echo ""
echo "=== Nginx security headers ==="
curl -v http://localhost:8080/ 2>&1 | grep -E "X-Content|X-Frame|X-Fer"

; Expected: May have different headers depending on Nginx config
```

### Test firewall blocks port 3000

```bash
; Verify port 3000 is not directly accessible from host

; Attempt connection to port 3000 from host
curl -v http://localhost:3000/ 2>&1 | head -5

; Expected: "connection refused" or error because port 3000
; is not exposed to the host (only accessible via Docker network)

; Verify ports 80/443 ARE accessible
curl -v http://localhost:8080/ 2>&1 | head -3

; Expected: Works (Nginx on port 8080)

curl -k https://app1.localhost/ 2>&1 | head -3

; Expected: Works (Caddy on port 443 with TLS)
```

### Test trusted proxy configuration

```bash
; Verify Caddy recognizes trusted proxies (Cloudflare, etc.)

; In proxy-learn, we're not behind Cloudflare, but understand the concept:

; Caddy automatically trusts connections from the same host
; For Cloudflare, you'd configure:

; Caddyfile conceptual:
; trust_proxy {
;   remote 173.245.48.0/22  # Cloudflare IPv4
; }

; Or via environment variable:
; CADDY_TRUSTED_PROXY_NETWORKS=173.245.48.0/22

; Without explicit config, Caddy's default behavior is to trust
; the direct connection source (same host machine)

; Test the concept:
; If you were behind Cloudflare proxied:
; - Caddy would see CF-Connecting-IP header
; - $remote_addr would be Cloudflare's IP
; - With trust_proxy config, $remote_addr would be real visitor IP

; In proxy-learn (not behind Cloudflare):
; - Caddy sees direct connection from 127.0.0.1 or Docker network IP
; - No special config needed
```

### Common security misconfiguration check

```bash
; Run a quick security check on your proxy-learn setup

echo "=== Security Quick Check ==="

# 1. Is port 3000 exposed?
echo "1. Port 3000 externally accessible?"
curl -v http://localhost:3000/ 2>&1 | head -1 | grep -i "connection refused" && echo "✅ Port 3000 blocked (good)" || echo "⚠️ Port 3000 accessible (review)"

# 2. Are security headers present?
echo ""
echo "2. Security headers on Caddy HTTPS?"
curl -v -k https://app1.localhost/ 2>&1 | grep -E "X-Content|X-Frame" && echo "✅ Headers present" || echo "⚠️ Headers missing"

# 3. Is firewall configured?
echo ""
echo "3. Firewall blocking unnecessary ports?"
iptables -L INPUT -n 2>/dev/null | grep "3000\|DROP" | head -3 && echo "✅ Firewall rules present" || echo "ℹ️ Using Docker networking (may not need iptables)"

# 4. Are CNAME records monitored?
echo ""
echo "4. Subdomain takeover monitoring?"
echo "✅ Regular DNS audits recommended (outside scope of proxy-learn)"

# 5. Is HSTS enabled?
echo ""
echo "5. HSTS header present?"
curl -I -k https://app1.localhost/ 2>&1 | grep -i "strict-transport-security" && echo "✅ HSTS enabled" || echo "⚠️ HSTS not set"
```

---

## 5. In a real multi-tenant SaaS

### Security headers for SaaS tenants:

```caddyfile
; Per-tenant security headers

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Security headers for this tenant
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-origin-only"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    
    # Tenant-specific header
    X-Tenant-Id "store-a"
  }
  
  reverse_proxy app-a:3000
}

store-b.example.com {
  tls /etc/caddy/certs/store-b-cert.pem /etc/caddy/certs/store-b-key.pem
  
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-origin-only"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    
    X-Tenant-Id "store-b"
  }
  
  reverse_proxy app-b:3000
}
```

### Subdomain takeover prevention workflow:

```text
# Ongoing monitoring for subdomain takeover risks

# 1. Weekly DNS audit:
;   - List all CNAME records for your SaaS domains
;   - Verify each target service still exists
;   - Document expected vs actual CNAME targets
;   - Remove CNAMEs for deleted services

# 2. Certificate monitoring:
;   - Monitor Let's Encrypt expiry dates
;   - Monitor cert issuance failures (may indicate dangling DNS)
;   - Set up alerts for cert renewal failures

# 3. Custom domain onboarding/offboarding:
;   - When merchant adds domain: verify CNAME target exists
;   - When merchant leaves: immediately remove CNAME record
;   - Wait for DNS propagation after removal
;   - Verify cert issuance fails (expected for removed domain)
;   - Clean up any remaining records

# 3. Monitoring tools:
;   - Automated DNS health checks
;   - Let's Encrypt cert expiry alerts
;   - Custom scripts to detect dangling records
```

### Host header injection prevention for SaaS:

```caddyfile
; SaaS Host header validation

; The backend must validate the Host header against expected tenants

; Caddy passes the Host header - the app must validate it

store-*.example.com {
  # Caddy reverse proxies regardless,
  # but the application must validate
  
  reverse_proxy app:3000
  
; Application-level validation (Node.js Express example):
;
; const allowedHosts = [
;   'store-a.example.com',
;   'store-b.example.com',
;   // ... all allowed tenant domains
; ];
;
; app.use((req, res, next) => {
;   const host = req.get('Host')?.toLowerCase();
;   if (!allowedHosts.includes(host)) {
;     return res.status(403).send('Invalid or spoofed Host header');
;   }
;   next();
; });
```

### Firewall rules for SaaS custom domains:

```bash
; Host-level firewall for SaaS infrastructure

; Allow only necessary ports
; ufw (simplified):
; ufw allow 80/tcp   # HTTP - for Let's Encrypt HTTP-01 challenges
; ufw allow 443/tcp  # HTTPS - primary web traffic
; ufw allow 8080/tcp # Nginx (if used)
; ufw deny 3000/tcp  # Block Node.js app port
; ufw default deny   # Deny everything else

; iptables (more granular):
; iptables -A INPUT -p tcp --dport 80 -j ACCEPT
; iptables -A INPUT -p tcp --dport 443 -j ACCEPT
; iptables -A INPUT -p tcp --dport 8080 -j ACCEPT (optional)
; iptables -A INPUT -p tcp --dport 3000 -j DROP   # Block app port
; iptables -A INPUT -j DROP                       # Drop all other

; Docker network considerations:
; - Ports 80/443 exposed to host for Caddy/Nginx access
; - Port 3000 NOT exposed (only via reverse proxy)
; - Docker bridge network (172.23.0.0/16) allows intra-container comm
```

### TLS/certificate security for SaaS:

```text
; Certificate best practices for multi-tenant SaaS:

; 1. Per-tenant certificates (recommended)
;    - Each tenant gets their own cert (store-a.example.com, store-b.example.com)
;    - Isolated compromise (if one cert is exposed, others unaffected)
;    - More management overhead but better security
;
; 2. Wildcard certificate (alternative)
;    - One cert: *.example.com
;    - Covers all subdomains
;    - Easier management, single point of failure
;    - Harder to revoke individual tenants
;    - Requires DNS-01 challenge for issuance
;
; 3. Let's Encrypt certificate lifecycle:
;    - 90-day validity (short, forces regular renewal)
;    - Auto-renewal via Caddy (recommended)
;    - 5 new certs/domain/week rate limit (use staging for testing)
;
; 4. Certificate revocation:
;    - If a private key is compromised
;    - If a merchant leaves the SaaS
;    - Use certbot revoke or Caddy admin API
;    - Revoke before removing from SaaS dashboard
;
; 5. CAA records (Control Certificate Authority):
;    - Example: "0 issue "letsencrypt.org""
;    - Ensures only Let's Encrypt can issue certs
;    - Can block other CAs (good for security policy)
;    - Add to domain's DNS records if you want to restrict
```

### Security headers checklist for SaaS deployment:

```text
; Pre-deployment security header verification:

# 1. X-Content-Type-Options: nosniff
#    ✅ Prevents MIME sniffing attacks

# 2. X-Frame-Options: DENY or SAMEORIGIN
#    ✅ Prevents clickjacking (site framing)

# 3. Referrer-Policy: strict-origin-when-origin-only
#    ✅ Controls referrer information leakage

# 4. Strict-Transport-Security (HSTS)
#    ✅ Forces HTTPS, prevents downgrade attacks
#    - max-age: at least 31536000 (1 year)
#    - includeSubDomains: apply to all subdomains
#    - preload: add to browser preload list (if applicable)

# 5. Content-Security-Policy (optional but recommended)
#    ✅ Prevents XSS and data injection attacks
#    - Can be complex to configure correctly
#    - May be added later after basic headers

# 6. X-XSS-Protection (legacy, often replaced by CSP)
#    ✅ Older IE protection, still useful as fallback
#    - Value: "1; mode=block"

# 7. Permissions-Policy (formerly Feature-Policy)
#    ✅ Controls browser features (camera, microphone, geolocation)
#    - Useful for SaaS with rich web features
```

---

## 6. When to use it and when NOT to

**Use security knowledge when**:
- Configuring firewalls and port exposure
- Setting up SSL/TLS and certificate management
- Preventing subdomain takeovers and dangling DNS
- Implementing host header injection prevention
- Adding security headers (HSTS, CSP, etc.)
- Rate limiting and abuse protection

**NOT to skip security basics**:

- Never expose backend ports (like 3000) to the internet
- Never ignore certificate expiration or renewal
- Never use "Flexible" SSL mode in production
- Never skip the Host header validation in SaaS
- Never ignore DNS propagation after record changes
- Never leave default passwords or open ports
- Never use self-signed certs in production without proper trust

---

## 7. Common mistakes

- **Exposing backend ports**: Port 3000 (or any app port) should never be directly accessible from the internet. Keep it internal only.
- **Using "Flexible" SSL mode**: Unencrypts the visitor→proxy segment. Always use "Full" or "Full (strict)".
- **Not monitoring certificate expiration**: Let's Encrypt certs expire in 90 days. Set up renewal alerts.
- **Ignoring DNS propagation**: After changing DNS records, wait for TTL-based propagation before assuming the change is complete.
- **Not validating Host headers**: In SaaS, an attacker could forge the Host header to gain unauthorized access or perform actions as other tenants.
- **Leaving debugging endpoints exposed**: Don't leave `/debug`, `/admin`, or diagnostic endpoints publicly accessible.
- **Using weak cipher suites**: Configure TLS to use only modern, secure cipher suites (TLS 1.2+ with strong ciphers).
- **Not updating software**: Keep Caddy, Nginx, Node.js, and all dependencies up to date with security patches.
- **Missing WAF rules**: For production SaaS, consider adding a Web Application Firewall (Cloudflare, ModSecurity, etc.) to filter malicious traffic.
- **Running as root**: Caddy and Node.js should run as non-root users for principle of least privilege.

---

## 8. Try it yourself

**Exercise**: Test security concepts and configure your proxy-learn setup securely.

```bash
# 1. Test that port 3000 is NOT externally accessible
echo "=== Testing port 3000 exposure ==="
curl -v http://localhost:3000/ 2>&1 | head -1

; Expected: "connection refused" (port 3000 not exposed to host)
; This is good - the app is only accessible via Caddy/Nginx

# 2. Test that ports 80/443 ARE accessible
echo ""
echo "=== Testing port 80/443 accessibility ==="
curl -v http://localhost:8080/ 2>&1 | head -1   ; Nginx port
curl -k https://app1.localhost/ 2>&1 | head -1  ; Caddy HTTPS port

; Expected: Both should work

# 3. Test security headers on Caddy HTTPS
echo ""
echo "=== Testing Caddy security headers ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -E "X-Content|X-Frame|Strict-Transport"

; Expected: Should show X-Content-Type-Options, X-Frame-Options, 
; and Strict-Transport-Security (HSTS)

# 4. Test security headers on Nginx HTTP
echo ""
echo "=== Testing Nginx security headers ==="
curl -v http://localhost:8080/ 2>&1 | grep -E "X-Content|X-Frame|Strict-Transport"

; Expected: May have different headers based on Nginx config

# 5. Test Host header validation concept
echo ""
echo "=== Host header test ==="
echo "Normal request:"
curl -k -s https://app1.localhost/ | head -2

echo ""
echo "With modified Host header (if app validates):"
curl -k -s https://app1.localhost/ -H "Host: evil-domain.com" 2>/dev/null | head -2

; Expected: App may reject the fake Host header (depends on app config)

# 6. Check firewall status (conceptual)
echo ""
echo "=== Firewall quick check ==="
; iptables -L INPUT -n 2>&1 | grep "3000\|80\|443" | head -5
; Or just note: proxy-learn uses Docker networking, ports 80/443 exposed,
; port 3000 not externally accessible

; Expected: Understanding that port 3000 is protected by Docker network

# 7. Verify Caddy security configuration
echo ""
echo "=== Caddy security review ==="
cat /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile

; Expected: Caddyfile with tls directive, reverse_proxy, and security headers
; The header block adds X-Content-Type-Options, X-Frame-Options, etc.

# 8. Clean up
echo ""
echo "=== Cleanup ==="
; Remove any test modifications

; Cleanup note: No actual cleanup needed - proxy-learn is in original state
```

**Hint**: Key security takeaways for your proxy-learn setup:

| Security Aspect | Your Current Status | Recommendation |
|-----------------|--------------------|----------------|
| Port 3000 exposure | Not externally accessible (Docker network only) | ✅ Good - keep this way |
| Security headers | Caddy adds them automatically | ✅ Good - no changes needed |
| SSL/TLS mode | Local CA certificates (HTTPS working) | ✅ Good for learning |
| Port 80/443 exposure | Exposed (for Caddy/Nginx) | ✅ Necessary - only these ports |
| Host header validation | App echoes the Host header | ⚠️ For SaaS, add validation |
| Subdomain takeover | No CNAME records (/etc/hosts) | ✅ Lower risk |
| HSTS | Caddy adds it automatically | ✅ Good |
| Firewall | Docker networking provides isolation | ✅ Good |

**Cleanup**: No cleanup needed - proxy-learn is in its original secure configuration.

---

## Next

[[15-troubleshooting]] - Learn about a checklist for "my domain doesn't work" (DNS not propagated, wrong record, CAA blocking, port 80 blocked, certificate errors, mixed content, redirect loops).