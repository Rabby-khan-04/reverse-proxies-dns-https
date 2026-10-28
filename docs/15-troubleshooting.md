# docs/15-troubleshooting.md

## 1. Simple explanation (like I'm 7)

**Troubleshooting** is like being a detective for your website. When something doesn't work, you look for clues, test different things, and find the problem.

### The "My domain doesn't work" checklist:

**Step 1: DNS propagation**
- Is the domain pointing to the right place?
- Use `dig` or `nslookup` to check
- Wait if TTL is high

**Step 2: Record type**
- Is it a CNAME or A record?
- Is the target correct?

**Step 3: HTTPS certificates**
- Is the certificate valid?
- Is the CAA record blocking issuance?
- Is port 80 open for Let's Encrypt?

**Step 4: Proxy configuration**
- Is the reverse proxy running?
- Are headers forwarded correctly?
- Is the backend app running?

**Step 5: Redirect loops**
- Is HTTP→HTTPS→HTTP looping?
- Is www↔non-www looping?

**Step 6: Mixed content**
- Is the page partly HTTPS and partly HTTP?
- Fix all resources to HTTPS

**Step 7: Firewall blocking**
- Is a firewall blocking port 80 or 443?
- Is the app port (3000) accessible?

---

## 2. Real name

**Troubleshooting** is the process of identifying and resolving problems in a system. In the context of DNS, HTTPS, and reverse proxies, it involves methodically checking each component of the request flow.

**Common troubleshooting tools**:

| Tool | What it does | When to use |
|------|-------------|-------------|
| **`dig`** | DNS query tool - looks up IP addresses, record types | When domain won't resolve, check DNS records |
| **`nslookup`** | Alternative DNS query tool | When `dig` behaves differently or you need simpler output |
| **`curl -v`** | Verbose HTTP requests - shows headers, status codes | When testing proxy connectivity, see what's happening |
| **`openssl s_client`** | TLS/SSL connection tester - shows certificate details | When there are certificate errors or TLS handshake failures |
| **`curl -I`** | Headers-only request - shows response headers | When checking caching, security headers, cache-control |
| **`curl -o /dev/null -s -w "%{http_code}"`** | Shows just the HTTP status code | When you need the status code quickly |
| **`ping`** | Basic network reachability | When you need to check if a host is reachable |
| **`traceroute`** | Shows the path packets take | When diagnosing network routing issues |

**Troubleshooting methodology**:

```text
1. Reproduce the issue: What exactly happens?
2. Identify the component: DNS? Proxy? TLS? Backend?
3. Check the simplest thing first: Is the service running? Is DNS working?
4. Work through the stack: DNS → Proxy → TLS → Backend
5. Document findings: What worked, what didn't
6. Fix one thing at a time: Don't change multiple things simultaneously
7. Verify the fix: Test thoroughly
8. Document the solution: For future reference
```

---

## 2. Checklist: "My domain doesn't work"

### Phase 1: DNS Resolution

- [ ] **DNS records propagated**: Use `dig domain.com A +short` to verify
- [ ] **Correct record type**: CNAME for subdomains, A for root (or ALIAS)
- [ ] **TTL considerations**: Low TTL = changes propagate fast; High TTL = wait up to 24 hours
- [ ] **/etc/hosts entries**: If using local setup, verify entries are correct
- [ ] **Nameserver configuration**: If using Cloudflare or other DNS provider, check NS records

### Phase 2: Proxy Connectivity

- [ ] **Reverse proxy running**: `docker compose ps` or `systemctl status caddy/nginx`
- [ ] **Ports 80/443 accessible**: `curl http://localhost/` or `curl -k https://domain/`
- [ ] **Backend app running**: Check `docker compose ps` for the app container
- [ ] **Host header forwarded**: The backend should see the correct `Host` header
- [ ] **Docker network healthy**: `docker network inspect proxy-learn_proxy-learn-network`

### Phase 3: TLS/HTTPS

- [ ] **Certificate valid**: `openssl verify` or browser lock icon
- [ ] **Certificate not expired**: Check `notAfter` date
- [ ] **CAA records not blocking**: `dig domain.com CAA +short` - should be empty or allow your CA
- [ ] **Port 80 open** (for Let's Encrypt HTTP-01): `curl http://domain.com/.well-known/acme-challenge/...`
- [ ] **TLS handshake works**: `openssl s_client -connect domain:443 -servername domain`
- [ ] **SNI supported**: Ensure clients aren't too old (very old Android/IE)

### Phase 4: Redirects

- [ ] **No redirect loops**: Check `http://domain/` → `https://domain/` chain
- [ ] **www vs non-www**: One redirect, not both ways
- [ ] **301 vs 302**: Using permanent (301/308) for HTTP→HTTPS, not temporary
- [ ] **Location header present**: Redirect responses must have a `Location` header

### Phase 5: Mixed Content

- [ ] **All resources HTTPS**: Check page source for `http://` resources on `https://` page
- [ ] **CDN caching**: If using Cloudflare, ensure cached resources are HTTPS
- [ ] **Subresource integrity**: If using hashed CSS/JS, ensure hashes match

### Phase 6: Firewall & Network

- [ ] **Port 80 not blocked**: Firewall allows inbound HTTP
- [ ] **Port 443 not blocked**: Firewall allows inbound HTTPS
- [ ] **Port 3000 not exposed**: App port should not be publicly accessible
- [ ] **Docker network functioning**: Containers can communicate within the network
- [ ] **No IP conflicts**: No duplicate IPs on the Docker network

---

## 3. Commands and what you should see

### DNS troubleshooting commands

```bash
; 1. Check A record (IP address)
dig example.com A +short

; Expected output (your proxy-learn /etc/hosts setup):
127.0.0.1

; If you see no output or different IP:
; - Check /etc/hosts entries
; - Check if using real DNS and records are configured

; 2. Check CNAME record
dig store.example.com CNAME +short

; Expected: proxy.your-saas.com (or whatever your proxy domain is)

; 3. Check NS records (name servers)
dig example.com NS +short

; Expected: Your DNS provider's nameservers

; 4. Check CAA records (Certificate Authority Authorization)
dig example.com CAA +short

; Expected: (empty = any CA can issue) or "0 issue "letsencrypt.org""
; If showing "0 issue "other-ca.com"" - only that CA can issue certs
; This would block Let's Encrypt automatic HTTPS!

; 5. Check TTL value
dig example.com +ttl +short

; Expected: Shows TTL in seconds (e.g., 3600 = 1 hour, 300 = 5 minutes)

; 6. Check NSLOOKUP (alternative DNS tool)
nslookup example.com

; Expected: Should resolve to same IP as dig
; Different output format but same information
```

### Proxy/connectivity troubleshooting commands

```bash
; 1. Test Caddy HTTPS (your current setup)
curl -k https://app1.localhost/

; Expected: HTML from the app, showing "Host header: app1.localhost"

; 2. Test verbose to see details
curl -v -k https://app1.localhost/ 2>&1 | head -20

; Expected: Shows SSL connection, server info, headers

; 3. Test HTTP through Nginx
curl -v http://localhost:8080/

; Expected: HTML from the app, served by Nginx

; 4. Test with IP directly (bypassing DNS)
curl -v http://127.0.0.1:8080/

; Expected: Should work if Docker network is healthy

; 5. Test backend app health
curl -v http://localhost:3000/health 2>&1

; Expected: JSON health check from your Node.js app

; 6. Test with follow redirects
curl -L -s http://localhost:8080/ 2>&1 | head -3

; Expected: Follows redirects and shows final content

; 7. Status code only (quick check)
curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/

; Expected: 200 (OK), 301/302 (redirect), 502 (bad gateway), etc.

; 8. Headers only (quick check)
curl -I http://localhost:8080/ 2>&1

; Expected: Shows response headers (X-Frame, X-Content, etc.)
```

### TLS/HTTPS troubleshooting commands

```bash
; 1. Full TLS test with openssl
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | head -30

; Expected: Shows TLS handshake succeeded, cipher, certificate chain

; Key output to look for:
; - "CONNECTED(00000003)" - connection established
; - "depth=2 CN=localhost-CA" - certificate chain
; - "verify: OK" - certificate verification passed
; - "SSL handshake has completed" - handshake succeeded
; - "Protocol  : TLSv1.3" - TLS version
; - "Cipher    : TLS_AES_128_GCM_SHA256" - encryption cipher

; 2. Certificate details
openssl x509 -in /path/to/cert.pem -noout -subject -issuer -dates

; Expected: subject, issuer, and validity dates

; 3. Check if cert and key match (modulus comparison)
echo "Cert modulus:"; openssl x509 -in cert.pem -noout -modulus | md5sum
echo "Key modulus:"; openssl rsa -in key.pem -noout -modulus | md5sum

; Expected: Both should show the same MD5 hash (if they match)

; 3. Test without certificate verification (like curl -k)
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | grep "Protocol"

; Expected: Shows TLSv1.3 or TLSv1.2

; 4. Check certificate chain
openssl verify -CAfile /path/to/ca-cert.pem /path/to/server-cert.pem

; Expected: OK (if CA cert signed the server cert)

; 5. Test HTTP->HTTPS redirect
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/ 2>/dev/null

; Expected: 301 (Moved Permanently) or 308 (Permanent Redirect)

; 6. Test HTTPS directly (should bypass redirect)
curl -o /dev/null -s -w "%{http_code}" https://app1.localhost/ 2>/dev/null

; Expected: 200 (OK)
```

### Redirect troubleshooting commands

```bash
; 1. Check redirect status code
curl -o /dev/null -s -w "%{http_code}" http://domain.com/ 2>/dev/null

; Expected: 301, 302, 307, or 308

; 2. Check redirect location
curl -o /dev/null -s -w "%{http_code}" -D - http://domain.com/ 2>/dev/null | grep Location

; Expected: Shows the Location header value (the redirect target)

; 3. Test redirect follows (curl -L)
curl -L -s http://domain.com/ 2>&1 | head -3

; Expected: Shows content at the redirect target

; 4. Check for redirect loops (browser shows "too many errors")
;    - Use curl without -L to see the redirect chain
;    - Or use online redirect checker tools

; 5. Test HTTP->HTTPS specifically
curl -o /dev/null -s -w "%{http_code}" http://domain.com/ 2>/dev/null

; Expected: 301/308 (permanent HTTP→HTTPS redirect)

; 6. Test HTTPS directly
curl -o /dev/null -s -w "%{http_code}" https://domain.com/ 2>/dev/null

; Expected: 200 (should work after redirect)
```

### Mixed content troubleshooting

```bash
; 1. Check page source for http:// resources on https:// page
;    - Right-click → "View Page Source" in browser
;    - Search for "http://" while on the HTTPS page

; 2. Browser developer console
;    - Open F12 → Console tab
;    - Look for "Mixed Content" warnings
;    - Browsers block mixed content automatically

; 2. curl with verbose to see all resources
curl -v -k https://domain.com/ 2>&1 | grep "http://"

; Expected: Should show no "http://" resources (all should be https://)

; 2. Online mixed content checkers
;    - Use tools like "Why No Padlock?" or browser dev tools

; 3. Fix: Update all http:// to https:// in your app/templates/CDN
;    - Or use protocol-relative URLs: //domain.com/resource
;    - Or use relative URLs: /resource (same protocol)
```

### Firewall/network troubleshooting

```bash
; 1. Check if port is accessible
;    - curl http://domain.com:80/  (should work)
;    - curl http://domain.com:443/  (should work with TLS)
;    - curl http://domain.com:3000/  (should fail - port not exposed)

; 2. Test with different networks
;    - WiFi vs wired Ethernet
;    - Mobile data vs home WiFi
;    - Different location (library, cafe, work)

; 3. Check Docker network
docker network inspect proxy-learn_proxy-learn-network 2>&1 | grep -E "IPv4\|Gateway"

; Expected: Shows the Docker bridge network configuration
; IP addresses for each container
; Gateway for external connectivity

; 3. Test container connectivity
docker exec proxy-learn-app ping -c 3 proxy-learn-nginx

; Expected: Should work if Docker network is healthy

; 4. Check for port conflicts
;    - Are any other services using port 80 or 443?
;    - Are there duplicate Caddy/Nginx instances?

; 5. Test external access (if you have a public IP/domain)
;    - From a different network/location
;    - Compare with local access
```

---

## 4. Common problems and solutions

### Problem 1: "My domain resolves but HTTPS doesn't work"

**Possible causes**:
- Certificate not yet issued (staging vs production)
- CAA record blocking your CA
- Port 80 blocked (for HTTP-01 challenge)
- Certificate and key don't match

**Solutions**:
1. Check `openssl s_client -connect domain:443` output
2. Run `dig domain.com CAA +short` - if showing a CA that's not Let's Encrypt, you need to adjust
3. Verify cert/key modulus match
4. Check Caddy logs: `docker compose logs caddy`

### Problem 2: "Too many redirects"

**Possible causes**:
- HTTP→HTTPS→HTTP loop
- www↔non-www loop conflicting redirects
- Caddy/Nginx config has conflicting redirect rules

**Solutions**:
1. Check Caddy/Nginx config for duplicate redirect blocks
2. Use `curl -v http://domain/` to see the redirect chain
3. Simplify to one redirect: HTTP→HTTPS only (or www→non-www, not both)
4. In Caddy, ensure only one `redir` directive is active

### Problem 3: "Domain resolves but shows wrong content"

**Possible causes**:
- Host header not forwarded correctly
- Backend not routing based on Host header
- Multiple tenants on same IP without proper routing

**Solutions**:
1. Check `curl -k https://domain/headers` - should show correct Host
2. Verify the app's tenant routing logic
3. Ensure `proxy_set_header Host $host` (Nginx) or Caddy's `reverse_proxy` (automatic)
4. Check that the app's `Host` header matching logic is correct

### Problem 4: "DNS changes don't take effect"

**Possible causes**:
- TTL too high (changes take up to 24 hours)
- /etc/hosts not reloaded (usually immediate, but some apps cache)
- Using real DNS provider with caching intermediate resolvers

**Solutions**:
1. Check TTL value with `dig domain.com +ttl +short`
2. Lower TTL before making changes (set to 300 = 5 minutes)
3. Wait 5-10 minutes after TTL change
4. In /etc- hosts: changes are immediate (TTL 0)
5. Clear local DNS cache: `sudo systemd-resolve --flush-caches` or `sudo killall -HUP mDNSResponder`

### Problem 5: "HTTP works but HTTPS shows certificate error"

**Possible causes**:
- Self-signed cert not trusted by browser
- Certificate expired
- Certificate issued for wrong domain
- CAA record blocking your CA
- Mixed content (some http:// resources on https:// page)

**Solutions**:
1. For self-signed: Use `curl -k` or add cert to browser trust store
2. Check cert validity: `openssl x509 -in cert.pem -noout -dates`
3. Verify cert CN/SAN matches the domain
4. Check `dig domain.com CAA +short`
5. Fix mixed content (all resources must be HTTPS)

### Problem 6: "404 Not Found or 502 Bad Gateway"

**Possible causes**:
- Backend app not running
- Wrong proxy_pass target
- Docker network issues
- Resource limits exceeded

**Solutions**:
1. Check `docker compose ps` - all containers running?
2. Check `docker compose logs app` - any errors?
3. Verify `proxy_pass http://app:3000;` resolves correctly
4. Check Docker network: `docker network inspect`
5. Restart containers: `docker compose restart`

---

## 5. Real-world patterns (Your proxy-learn setup)

### Full custom-domain flow on local setup:

```text
# What happens when a merchant configures their custom domain in proxy-learn:

# Step 1: Merchant adds domain to SaaS dashboard
;   - Domain: store.example.com

# Step 2: SaaS shows DNS instructions
;   - "Add CNAME: store → your-proxy-domain"

# Step 3: Merchant adds CNAME at domain registrar
;   - In proxy-learn, we simulate this by adding to /etc/hosts:
;   echo "127.0.0.1 store.example.com" >> /etc/hosts

# Step 4: DNS resolution (immediate in /etc/hosts)
;   dig store.example.com +short
;   127.0.0.1

# Step 5: Request comes in with Host header
;   Browser: GET https://store.example.com/
;   Caddy receives request with Host: store.example.com

# Step 5: App resolves tenant from Host header
;   Node.js app looks up: tenants['store.example.com']
;   Returns the correct tenant's content

# Step 6: HTTPS is served
;   Caddy serves HTTPS (local cert for store.example.com)
;   Or Let's Encrypt if using real domains

# Step 7: Full flow verified
;   - DNS resolves
;   - HTTPS works
;   - Tenant content served based on Host header
```

### Next.js app behind Caddy:

```text
# When running a Next.js application behind Caddy:

# Next.js characteristics:
; - Develops on port 3000 by default
; - Server-Side Rendering (SSR) 
; - API routes (e.g., /api/...)
; - Static file generation (generate files at build time)

# Caddy configuration for Next.js:

; Caddyfile:
nextjs-store.example.com {
  tls /etc/caddy/certs/nextjs-cert.pem /etc/caddy/certs/nextjs-key.pem
  
  # Next.js serves both static and dynamic content
  # Caddy reverse_proxy passes everything through
  reverse_proxy app:3000
  
  # Handle WebSockets if Next.js uses them
  # Caddy's reverse_proxy handles WS upgrades automatically
  
  # Compress Next.js responses (automatic with Caddy)
  # Cache appropriate caching headers
}
```

### Zero-downtime config reload pattern:

```text
# How to reload Caddy/Nginx config without downtime:

# Caddy (has built-in smooth reload):
; 1. Modify Caddyfile
; 2. docker compose kill -s HUP caddy  # Send SIGHUP signal
;    Or: docker compose up -d caddy (auto-reload)
;    Or use admin API: curl -X POST http://localhost:2019/load

; Why it's smooth:
; - Caddy autosaves config to /config/caddy/autosave.json
; - New configuration loads on next request
; - Existing connections finish before shutdown
; - No "connection refused" during reload

# Nginx (requires graceful reload):
; 1 Modify nginx.conf
; 2. nginx -t  # Test syntax first
; 3. nginx -s graceful  # Gracefully reload
;    - Existing connections finish
; 4. Or: service nginx reload

; Zero-downtime pattern for SaaS:
; - Schedule reloads during low-traffic periods
; - Use Caddy's automatic HTTPS reload (no downtime)
; - Test config changes in staging first
; - Have rollback plan (previous config saved)
```

### Pitfalls of each configuration:

| Configuration | Common Pitfalls |
|--------------|----------------|
| **Caddy automatic HTTPS** | - CAA records blocking Let's Encrypt<br>- Port 80 blocked for HTTP-01 challenge<br>- Rate limits exceeded (too many new certs)<br>- DNS propagation not waited on|
; **Nginx + certbot** | - certbot modifies nginx.conf (backup needed!)<br>- Manual reload required after cert issuance<br>- Rate limit mishaps during testing<br>- Not renewal automation forgotten|
; **On-Demand TLS (`ask` endpoint)** | - `ask` endpoint returns wrong status codes<br>- Rate limiting not implemented → exhausted Let's Encrypt limits<br>- Testing in production directly (should use staging first)<br>- Domain validation insufficient → attackers get certs|
; **Wildcard certificates** | - DNS-01 challenge complex setup<br>- Harder to revoke per-tenant access<br>- If one subdomain compromised, all subdomains affected<br>- DNS provider API credentials in config|
; **Docker networking** | - `localhost` inside container ≠ host machine<br>- `proxy_pass http://localhost:3000` won't work<br>- Must use Docker service names (`app:3000`)- Port exposure must be intentional (80/443 yes, 3000 no)|
; **Host header handling** | - Forgetting `proxy_set_header Host $host` (Nginx)<br>- Caddy automatic but still verify backend sees it<br>- Not validating Host in SaaS app (security risk)<br>- Mixed Caddy/Nginx configs causing conflicts|
; **Cloudflare integration** | - Using "Flexible" SSL (dangerous, never use!)- Not updating nameservers when adding domain to Cloudflare<br>- Proxied mode without HTTPS on origin<br>- Page Rules conflicting with app redirects<br>- Cache TTL too long for dynamic SaaS content|
; **Firewall/ports** | - Exposing port 3000 to internet (big security risk)<br>- Not allowing ports 80/443<br>- Forgetting Docker network isolation<br>- Running as root user|
; **Security headers** | - Forgetting HSTS after enabling HTTPS<br>- Inconsistent www/non-www handling<br>- Missing X-Content-Type-Options (MIME sniffing)<br>- CSP too restrictive breaking site functionality|
```

---

## 5. When to use it and when NOT to

**Use troubleshooting knowledge when**:
- Diagnosing "my domain doesn't work" issues
- Debugging DNS, proxy, TLS, or redirect problems
- Checking service health and connectivity
- Recovering from misconfigurations
- Performing zero-downtime config reloads

**NOT to guess without testing**:

- Never assume a fix without verifying with commands
- Never change multiple things at once (hard to debug which fixed it)
- Never ignore error logs (Caddy, Nginx, app containers)
- Never skip the systematic checklist (go step by step)
- Never skip DNS propagation waiting when TTL is high

---

## 6. Common mistakes

- **Not using the checklist systematically**: Going straight to "it's the DNS" without checking if the service is running
- **Changing multiple things at once**: Making config changes, restarting containers, and clearing cache all at once - can't tell what fixed it
- **Skipping DNS propagation**: Making DNS changes and expecting immediate effect without considering TTL
- **Ignoring error logs**: Not checking `docker compose logs caddy` or `nginx error.log`
- **Forgetting to verify after fixing**: Fix the issue, then test thoroughly instead of assuming
- **Using `nslookup` when `dig` is more appropriate**: Different output, `dig` is more feature-rich for troubleshooting
- **Forgetting to clear local DNS cache**: Changes may not appear due to local caching
- **Testing from the wrong network**: Testing from a network with different firewalls/proxies than the production environment
- **Not checking the obvious**: Service not running, container stopped, config typo - skip these "simple" checks at your peril

---

## 7. Try it yourself

**Exercise**: Practice troubleshooting with your proxy-learn setup.

```bash
# 1. Practice the systematic troubleshooting checklist
echo "=== Troubleshooting Practice ==="

; Scenario: "HTTPS doesn't work for app1.localhost"

echo ""
echo "Step 1: Check if services are running"
docker compose ps 2>&1 | grep -E "caddy|app"

echo ""
echo "Step 2: Test HTTPS connectivity"
curl -k -s https://app1.localhost/ 2>&1 | head -2

echo ""
echo "Step 3: Check TLS details with openssl"
openssl s_client -connect app1.localhost:443 -servername app1.localhost 2>&1 | grep -E "Protocol|Cipher|verify"

echo ""
echo "Step 4: Check certificate validity"
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -dates

echo ""
echo "Step 5: Check if port 3000 is accessible (should not be directly)"
curl -v http://localhost:3000/ 2>&1 | head -1

echo ""
echo "Step 6: Check the app health endpoint"
curl -v http://localhost:3000/health 2>&1

; Expected: All services running, HTTPS works, cert valid, port 3000 not directly accessible

# 2. Practice DNS troubleshooting
echo ""
echo "=== DNS Troubleshooting Practice ==="

; Scenario: "I changed /etc/hosts but domain still doesn't resolve"

echo "Step 1: Verify /etc/hosts entries"
cat /etc/hosts | grep "127.0.0.1"

echo ""
echo "Step 2: Test dig immediately (should be instant with /etc/hosts)"
dig app1.localhost +short

echo ""
echo "Step 3: Compare with nslookup"
nslookup app1.localhost

echo ""
echo "Step 4: If using real DNS (not /etc/hosts), check TTL"
; dig domain.com +ttl +short

; Expected: /etc/hosts is immediate, real DNS has TTL

# 3. Practice redirect troubleshooting
echo ""
echo "=== Redirect Troubleshooting Practice ==="

; Scenario: "HTTP doesn't redirect to HTTPS"

echo "Step 1: Test HTTP status code"
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/

; Expected: 301 or 308 (redirect to HTTPS)

echo ""
echo "Step 2: Test HTTPS directly"
curl -o /dev/null -s -w "%{http_code}" https://app1.localhost/

; Expected: 200 (works after redirect)

echo ""
echo "Step 3: Test with verbose to see the redirect"
curl -v http://app1.localhost/ 2>&1 | head -10

; Expected: Shows 308 redirect, Location: https://app1.localhost/

# 3. Practice TLS troubleshooting
echo ""
echo "=== TLS Troubleshooting Practice ==="

; Scenario: "Certificate error in browser"

echo "Step 1: Test with curl -k (bypass cert check)"
curl -k -s https://app1.localhost/ 2>&1 | head -2

echo ""
echo "Step 2: Check cert details"
openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -subject -dates

echo ""
echo "Step 3: Verify cert and key match"
echo "Cert modulus:"; openssl x509 -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-cert.pem -noout -modulus | md5sum
echo "Key modulus:"; openssl rsa -in /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/certs/server-key.pem -noout -modulus | md5sum

; Expected: Both should show same MD5 hash (they match in proxy-learn)

# 4. Practice debugging "502 Bad Gateway"
echo ""
echo "=== 502 Bad Gateway Practice ==="

; Scenario: "Getting 502 error when accessing the site"

echo "Step 1: Check if backend app is running"
docker compose ps 2>&1 | grep app

echo ""
echo "Step 2: Check Caddy logs for errors"
docker compose logs caddy 2>&1 | tail -10

echo ""
echo "Step 2: Test backend directly (bypassing proxy)"
; If possible: curl from inside the Docker network
docker exec proxy-learn-app curl -s http://localhost:3000/ 2>&1 | head -3

; Expected: Backend should respond when accessed from within Docker network

# Cleanup: No cleanup needed - these exercises just read existing configurations and test running services.
```

**Hint**: Key troubleshooting principles:

1. **Start simple**: Is the service running? Is DNS working?
2. **Work through the stack**: DNS → Proxy → TLS → Backend
3. **One change at a time**: Document what you change
4. **Check the logs**: Caddy, Nginx, and app containers all log valuable info
5. **Verify, don't assume**: Always test after making changes
6. **Document your fixes**: For future reference and team knowledge

**Cleanup**: No cleanup needed - these exercises just read existing configurations and test running services.

---

## Next

[[16-real-world-patterns]] - Learn about the full custom-domain flow on the local setup, a Next.js app behind Caddy, and a zero-downtime config reload, with the pitfalls of each.