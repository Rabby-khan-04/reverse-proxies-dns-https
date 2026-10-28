# docs/09-forwarded-headers.md

## 1. Simple explanation (like I'm 7)

**Forwarded headers** are like a note that gets passed along to tell the server where the request really came from. When you go through a proxy (like Caddy or Nginx), the proxy changes some information.

### The main headers:

- **`X-Forwarded-For`**: "The original client's IP address". Without this, the server only sees the proxy's IP.
- **`X-Forwarded-Proto`**: "Was this HTTP or HTTPS?". Helps the server know if it should generate HTTPS links.
- **`Host`**: "The original domain name the client requested". Important for virtual hosting (many domains on one IP).

### Why they matter:

If you don't set these headers properly:
- The server thinks the request came from the proxy's IP (not the real client's IP)
- The server thinks the request was HTTP (not HTTPS), so it might redirect you away from the secure page
- The server can't tell which tenant's domain is making the request (important for SaaS)

Think of it like: You tell the proxy your real IP and whether it's HTTPS, the proxy writes it on a note and passes it to the server.

---

## 2. Real name

**Forwarded headers** are HTTP headers that transmit information from a client, through a proxy or load balancer, to the origin server. The most common ones are:

| Header | Official name | What it contains |
|--------|--------------|------------------|
| **`X-Forwarded-For`** | `XFF` | Client's original IP address (may be a chain of proxies) |
| **`X-Forwarded-Proto`** | `XFP` | Original protocol: `http` or `https` |
| **`X-Forwarded-Host`** | `XFH` | Original host header value |
| **`Forwarded`** | Standard header (RFC 7239) | Combined, standardized version of all forwarded headers |

**Why the `-Proto` and `-Host` notation**:

The `-Proto` and `-Host` suffixes are part of the convention for forwarded headers. They indicate:
- **`-Proto`**: The protocol scheme (`http` or `https`) that the client originally used
- **`-Host`**: The host header value the client originally sent (the domain name)

**Trusted proxy concept**:

A "trusted proxy" is a proxy that you've configured the server to trust. The server will only use the forwarded headers if the request comes from a trusted proxy IP. This prevents attackers from spoofing these headers.

---

## 3. Config example

### Caddyfile with forwarded headers (your current setup)

Your Caddyfile already handles this automatically:

```caddyfile
# Caddy automatically adds forwarded headers when reverse_proxy is used
app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Caddy automatically adds these headers:
  # - X-Forwarded-For
  # - X-Forwarded-Proto
  # - Host (preserved)
  
  reverse_proxy app:3000
  
  # Additional security headers
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
  }
}
```

**What Caddy does automatically**: When Caddy's `reverse_proxy` receives a request, it adds `X-Forwarded-For` and `X-Forwarded-Proto` based on the original request. You don't need to manually configure this.

### Nginx server block with forwarded headers (your comparison setup)

```nginx
server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # Manually set forwarded headers (Caddy does this automatically)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**What each nginx directive does**:

| Directive | What it sets | Equivalent in Caddy |
|-----------|-------------|---------------------|
| `proxy_set_header Host $host` | The `Host` header forwarded to backend | Caddy does this automatically |
| `proxy_set_header X-Real-IP $remote_addr` | The direct client IP | Caddy adds `X-Forwarded-For` which includes this |
| `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` | Chain of IPs (original + proxies) | Caddy adds this automatically |
| `proxy_set_header X-Forwarded-Proto $scheme` | `http` or `https` | Caddy adds this automatically |

### Caddy automatic vs Nginx manual:

**Caddy (automatic)**:
```caddyfile
reverse_proxy app:3000
# Caddy adds: X-Forwarded-For, X-Forwarded-Proto, Host
```

**Nginx (manual)**:
```nginx
location / {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Trusted proxy configuration:

#### Caddy trusted proxy (Caddyfile):

```caddyfile
# Only trust the internal Docker network proxy for forwarded headers
# This prevents outsiders from spoofing IP addresses

# Caddy automatically trusts requests from 127.0.0.1 and docker network IPs
# But you can be explicit:

app1.localhost {
  # Trust the proxy at 172.23.0.1 (Docker bridge network)
  # or trust the entire docker network
  # Caddy's default behavior trusts the connection if it's from the same host
  
  reverse_proxy app:3000
}
```

#### Nginx trusted proxy (nginx.conf):

```nginx
# Set up trusted proxy IP ranges
set_real_ip_from 127.0.0.1/32;     # Trust localhost
set_real_ip_from 172.23.0.0/16;    # Trust Docker bridge network
real_ip_header X-Forwarded-For;     # Use XFF to determine real IP

# Now $remote_addr will be the real client IP, not the proxy IP
server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
    }
}
```

**Note**: Nginx's `set_real_ip_from` and `real_ip_header` modules replace `$remote_addr` with the IP from the trusted header. This is more powerful than just adding headers.

### Multiple proxies chain (X-Forwarded-For handling):

When requests go through multiple proxies, the `X-Forwarded-For` header chains:

```text
Client (203.0.113.5) → Proxy1 (10.0.0.1) → Proxy2 (172.23.0.1) → Server

; After Proxy1 adds:
X-Forwarded-For: 203.0.113.5

; After Proxy2 adds (appends to the existing chain):
X-Forwarded-For: 203.0.113.5, 10.0.0.1

; The rightmost IP is the most recent proxy,
; the leftmost is the original client
```

**Caddy handles this correctly** by appending to the existing chain.

**Nginx with `proxy_add_x_forwarded_for`** also appends correctly.

### Getting the real client IP in your Node.js app:

```javascript
// Your Express app can read the real IP from the forwarded headers
app.get('/headers', (req, res) => {
  // Caddy/Nginx should have set these:
  
  const realIp = req.ip;  // Might be from X-Forwarded-For parsing
  constxff = req.get('X-Forwarded-For');  // "172.23.0.1, 203.0.113.5"
  const realClientIp =xff ?xff.split(',')[0].trim() : req.ip;
  
  const host = req.get('Host');
  const proto = req.get('X-Forwarded-Proto'); // "https"
  
  res.send(`
    <h1>Client IP info</h1>
    <p>Direct IP (req.ip): ${realIp}</p>
    <p>X-Forwarded-For header: ${xff}</p>
    <p>Real client IP (first in chain): ${realClientIp}</p>
    <p>Host header: ${host}</p>
    <p>Protocol: ${proto}</p>
  `);
});
```

---

## 4. Commands and what you should see

### Test forwarded headers with Caddy (your current setup)

```bash
# Test that Caddy forwards headers properly
curl -v -k https://app1.localhost/headers 2>&1 | grep -E "Host|X-Forwarded|Proto"

; Expected output:
<p>Host header: app1.localhost</p>
<p>X-Forwarded-For: 172.23.0.1</p>
<p>Proto: not set</p>
```

### Test forwarded headers with Nginx

```bash
# Test through Nginx (HTTP, port 8080)
curl -v http://localhost:8080/headers 2>&1 | grep -E "Host|X-Forwarded|Proto"

; Expected output:
<p>Host header: localhost</p>
<p>X-Forwarded-For: 172.23.0.1</p>
<p>Proto: not set</p>
```

### Check what IP the app sees

```bash
# Check the direct IP vs forwarded IP
curl -v -k https://app1.localhost/ 2>&1 | grep -E "IP|x-forwarded"

; Expected: Shows connection details including forwarded for info
```

### Test that headers are properly distinguished between Caddy and Nginx

```bash
# Both should forward X-Forwarded-For, but may differ in format

# Caddy output (expected):
; X-Forwarded-For: 172.23.0.1

# Nginx output (expected):  
; X-Forwarded-For: 172.23.0.1
```

### Verify trusted proxy behavior (if you modify configs)

```bash
# If you were to configure Nginx with set_real_ip_from:
; The $remote_addr would change from the proxy IP to the real client IP
; This is Nginx-specific and would require config changes

; In Caddy, trusted proxy is more automatic
; But you can test by checking if IP addresses look correct
```

### Check Caddy's automatic header addition

```bash
# Caddy's debug/logging shows header addition
docker compose logs caddy 2>&1 | grep -i "forwarded\|header"

; Expected: Shows Caddy adapting config and serving requests with proper headers
```

### Compare header sets: Caddy vs Nginx

```bash
# Full header comparison
echo "=== Caddy (HTTPS) ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -E "^< (Server|X-|Date)"

echo ""
echo "=== Nginx (HTTP) ==="
curl -v http://localhost:8080/ 2>&1 | grep -E "^< (Server|X-|Date)"
```

### Check X-Forwarded-Proto value

```bash
# Test with HTTP vs HTTPS to see the difference
echo "=== HTTP (should be 'http') ==="
curl -v http://localhost:8080/ 2>&1 | grep -i "x-forwarded-proto" || echo "Not set by Nginx in this test"

echo ""
echo "=== HTTPS (should be 'https') ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -i "x-forwarded-proto" || echo "Not set"
```

---

## 5. In a real multi-tenant SaaS

### Forwarded headers for tenant routing:

```caddyfile
# Caddy automatically forwards these, backend can use them

store-a.example.com {
  reverse_proxy app-a:3000
  
  # The backend can see:
  # - X-Forwarded-For: "203.0.113.5" (real client IP)
  # - X-Forwarded-Proto: "https" (secure connection)
  # - Host: "store-a.example.com" (the tenant's domain)
  
  # Example backend usage (Node.js Express):
  # const tenantDomain = req.get('Host');
  // const clientIp = req.get('X-Forwarded-For')?.split(',')[0];
  // const isSecure = req.get('X-Forwarded-Proto') === 'https';
}
```

### Nginx forwarded headers for SaaS:

```nginx
# Nginx config ensuring proper forwarded headers for SaaS

server {
    listen 443 ssl;
    server_name store-a.example.com;
    
    # Certbot-installed SSL
    ssl_certificate /etc/letsencrypt/live/store-a.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store-a.example.com/privkey.pem;
    
    location / {
        proxy_pass http://app-a:3000;
        
        # Critical for SaaS: these headers let the backend
        # know the real client and the tenant domain
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Client IP for rate limiting and security:

```caddyfile
# Rate limiting per client IP (using X-Forwarded-For)
# Caddy can rate limit based on forwarded headers

store-a.example.com {
  # Rate limit by client IP (from X-Forwarded-For)
  # This is conceptual - Caddy's rate limiting works on connection info
  # but the real IP should be available to your app via the header
  
  reverse_proxy app-a:3000
}
```

### HSTS and forwarded proto:

```caddyfile
# HSTS only applies over HTTPS, so checking X-Forwarded-Proto is important

store-a.example.com {
  # Force HTTPS via HSTS only if the connection was originally HTTPS
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    # Note: Caddy automatically adds HSTS when using tls/automatic HTTPS
    # But if behind another proxy, you may need to check the proto
  }
  
  reverse_proxy app-a:3000
}
```

### Handling broken proxy chains:

```caddyfile
# If there are multiple proxies, ensure headers aren't overwritten

# Caddy's default behavior appends to X-Forwarded-For, doesn't overwrite
# But if you have a chain: Client → Proxy1 → Proxy2 → Caddy

# Proxy1 adds: X-Forwarded-For: 203.0.113.5
# Proxy2 should append, not replace:
; Expected: X-Forwarded-For: 203.0.113.5, Proxy1's IP

# Caddy handles this correctly by default
# But if you explicitly set proxy_set_header, be careful not to overwrite

# Nginx: $proxy_add_x_forwarded_for appends; explicit set overwrites
```

### Forwarded header security considerations:

```text
SECURITY RISK: If forwarded headers are not properly validated,
attackers can spoof them to:

1. Hide their real IP address (anonymity/abuse)
2. Impersonate other clients (security bypass)
3. Bypass IP-based rate limits
4. Geolocation-based access control

PREVENTION:
- Only trust proxies you control (inside your infrastructure)
- Caddy: default trusts same-host connections
- Nginx: use `set_real_ip_from` to define trusted ranges
- Never trust `X-Forwarded-For` from an untrusted source
- In SaaS: validate the Host header matches a known tenant domain
```

---

## 6. When to use it and when NOT to

**Use forwarded headers knowledge when**:
- Configuring a reverse proxy (Caddy or Nginx)
- Setting up SaaS custom domains (need to identify tenant from Host header)
- Needing the real client IP for rate limiting, logging, or security
- Ensuring the backend knows if HTTPS is being used
- Debugging "wrong IP" or "wrong domain" issues

**NOT to skip forwarded headers**:

- Never run a reverse proxy without forwarding the `Host` header (HTTP/1.1 requirement)
- Never assume the backend knows the original domain without `Host` forwarding
- Never assume the backend knows if HTTPS is being used without `X-Forwarded-Proto`
- Never assume the backend sees the real client IP without `X-Forwarded-For` or `X-Real-IP`

---

## 7. Common mistakes

- **Forgetting to forward the `Host` header**: The backend sees `localhost` or the proxy IP instead of the actual domain. Causes routing failures.
- **Forgetting `X-Forwarded-Proto`**: Backend thinks request is HTTP, generates HTTP links, causes redirect loops (HTTP→HTTPS→HTTP).
- **Setting `X-Forwarded-For` to a static value**: Instead of using `$proxy_add_x_forwarded_for` or Caddy's automatic handling. This gives all clients the same fake IP.
- **Not trusting the proxy**: If the backend trusts ALL `X-Forwarded-For` headers, attackers can spoof IPs. Only trust proxies you control.
- **Using `proxy_set_header X-Forwarded-For $remote_addr`**: This overwrites the existing chain. Should use `$proxy_add_x_forwarded_for` to append.
- **Not handling multiple proxies**: The `X-Forwarded-For` chain can have multiple IPs. The "real" client IP is the leftmost; the rightmost is the most recent proxy.
- **Ignoring the `Forwarded` standard header**: RFC 7239 provides a standardized way to forward all info. Some modern setups use this instead of individual headers.

---

## 8. Try it yourself

**Exercise**: Test forwarded headers and understand their impact.

```bash
# 1. Test Caddy forwards headers (your current setup)
curl -v -k https://app1.localhost/headers 2>&1 | grep -E "Host|X-Forwarded|Proto"

; Expected: 
; Host header: app1.localhost  (correct - Caddy forwarded the original Host)
; X-Forwarded-For: 172.23.0.1  (correct - Caddy added the proxy IP)
; Proto: not set   (or https depending on Caddy version)

# 2. Test Nginx forwards headers
curl -v http://localhost:8080/headers 2>&1 | grep -E "Host|X-Forwarded|Proto"

; Expected:
; Host header: localhost  (correct for Nginx - it sees the connection as localhost)
; X-Forwarded-For: 172.23.0.1  (Nginx config adds this)
; Proto: not set   (Nginx may or may not set X-Forwarded-Proto)

# 3. Compare what the app sees vs what the proxy sees
; The proxy (Caddy/Nginx) sees the connection from 172.23.0.1 (Docker bridge)
; The app should see the real client IP via X-Forwarded-For

# 4. Test the difference between HTTP and HTTPS for X-Forwarded-Proto
; With Caddy HTTPS:
curl -v -k https://app1.localhost/ 2>&1 | grep -i "x-forwarded-proto"

; Expected: Should show "https" (Caddy sets this automatically)

; With Nginx HTTP:
curl -v http://localhost:8080/ 2>&1 | grep -i "x-forwarded-proto"

; Expected: May not be set (Nginx config determines this)

# 5. Test IP address detection
echo "=== Caddy HTTPS ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -E "X-Forwarded-For|X-Real-IP"

echo ""
echo "=== Nginx HTTP ==="
curl -v http://localhost:8080/ 2>&1 | grep -E "X-Forwarded-For|X-Real-IP"

; Expected: Both should show X-Forwarded-For: 172.23.0.1

# 6. Test with multiple header values concept
; Understand that X-Forwarded-For can chain:
; "client-proxy1-proxy2" format
; The first IP is the original client, last is the most recent proxy

# 7. Verify your config matches your needs
; For SaaS: You need Host (tenant domain) and X-Forwarded-Proto (HTTPS check)
; For security: You need X-Forwarded-For (real client IP)

# Cleanup: No cleanup needed - these commands only test running configurations.
```

**Hint**: The key differences between Caddy and Nginx for forwarded headers:

| Feature | Caddy | Nginx |
|---------|-------|-------|
| **Host header** | Automatically preserved | Must set `proxy_set_header Host $host` |
| **X-Forwarded-Proto** | Automatically set | Must set `proxy_set_header X-Forwarded-Proto $scheme` |
| **X-Forwarded-For** | Automatically appended | Must set `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` |
| **Trusted proxy** | Default behavior (same host) | Explicit `set_real_ip_from` config needed |
| **Simplicity** | "Just works" with `reverse_proxy` | More config lines required |

**Cleanup**: No cleanup needed - these commands only test the running proxy-learn setup.

---

## Next

[[10-websockets-compression-caching]] - Learn about WebSockets, compression, caching, request size limits, timeouts, and rate limiting at the proxy.