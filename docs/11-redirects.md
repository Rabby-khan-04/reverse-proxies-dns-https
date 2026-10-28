# docs/11-redirects.md

## 1. Simple explanation (like I'm 7)

**Redirects** are like when you change your address and put a "Forwarding Order" card on your old mailbox. When someone sends mail to your old address, the post office notices and sends it to your new address instead.

### Types of redirects:

- **Temporary redirect**: "I'm moving for now, come visit my old place for a while." (302 or 307)
- **Permanent redirect**: "I moved forever, go to my new place directly." (301 or 308)
- **HTTP to HTTPS**: "This website only works with the lock icon now, go to the secure version." 
- **www to non-www** (or reverse): "We shortened our address, go to the shorter version."

### Why redirects are needed:

1. **HTTP → HTTPS**: Most websites are now secure. If someone types `http://`, redirect them to `https://` so the connection is locked.
2. **www → non-www** (or reverse): Some people prefer `www.example.com`, others prefer `example.com`. Pick one and redirect the other.
3. **Domain changes**: If your SaaS changes domains, redirect old domains to new ones.
4. **Redirect loops**: "Go here!" → "Go there!" → "Go here!" never ends. Must be avoided!

---

## 2. Real name

**HTTP Redirect** is a response to a browser or client that tells it to go to a different URL. The response has a 3xx status code and a `Location` header telling where to go.

**Status codes for redirects**:

| Code | Meaning | Permanent vs Temporary | Browser behavior |
|------|---------|----------------------|-----------------|
| **301** | Moved Permanently | Permanent | Browser caches this, future requests go directly to new URL |
| **302** | Found (originally) | Temporary | Browser may cache or not, depends on implementation |
| **303** | See Other | Temporary (method-specific) | Always uses GET for the redirect response |
| **307** | Temporary Redirect | Temporary | Preserves the original HTTP method (POST stays POST) |
| **308** | Permanent Redirect | Permanent | Preserves the original HTTP method (POST stays POST) |

**`Location` header**: In the redirect response, tells the browser where to go next.

**Redirect loop**: When Request A → Response B (new URL) → Request B → Response A (original URL) → ... never ends. Browser shows "too many redirects" error.

---

## 3. Config example

### Caddyfile redirects (your current setup)

Your Caddyfile has HTTP→HTTPS redirect implicit, but you can be explicit:

```caddyfile
# Caddy automatically redirects HTTP to HTTPS when using automatic HTTPS
# But you can be explicit:

localhost:80 {
  # Redirect all HTTP requests to HTTPS
  redir https://{host}{uri} 301
  
  # Or specifically for a subdomain
  # redir https://{host}{uri} 302
}
```

### Caddyfile with www ↔ non-www redirects:

```caddyfile
# Redirect www to non-www
www.example.com {
  redir https://example.com{uri} 301
}

# Redirect non-www to www
example.com {
  redir https://www.example.com{uri} 301
}
```

### Caddyfile with custom redirect rules:

```caddyfile
# Redirect old path to new path
/old-blog/* {
  redir /new-blog{uri} 301
}

# Redirect with query parameters preserved
# {uri} includes the path and query string automatically
```

### Nginx redirects (your comparison setup):

```nginx
# Nginx HTTP to HTTPS redirect
server {
    listen 80;
    server_name app1.localhost;
    
    # Redirect HTTP to HTTPS (301 permanent)
    return 301 https://$host$request_uri;
}

# Nginx www to non-www redirect
server {
    listen 80;
    server_name www.app1.localhost;
    
    # Redirect www to non-www
    return 301 https://app1.localhost$request_uri;
}
```

### Nginx with permanent redirect:

```nginx
# 301 redirect from old domain to new
server {
    listen 80;
    server_name old-domain.com;
    
    # Permanent redirect
    return 301 https://new-domain.com$request_uri;
}
```

### Nginx temporary redirect:

```nginx
# 302 temporary redirect
server {
    listen 80;
    server_name app1.localhost;
    
    # Temporary redirect
    return 302 http://old-behavior.app1.localhost$request_uri;
}
```

### Caddyhandle blocks for conditional redirects:

```caddyfile
# Conditional redirects based on the request
app1.localhost {
  # If the request is for HTTP, redirect to HTTPS
  # Caddy does this automatically with automatic HTTPS
  
  # If a specific path is accessed, redirect
  # /admin → /dashboard
  handle {
    route {
      # If path starts with /old
      if {path} * "/old*" {
        redir /new{uri} 301
      }
    }
  }
  
  reverse_proxy app:3000
}
```

### Nginx with if-else-like redirect logic:

```nginx
# Nginx can't do if-else natively, but can use multiple server blocks
# or the return directive for simple cases

server {
    listen 80;
    server_name app1.localhost;
    
    # Simple redirect
    location / {
        # Permanent redirect
        # return 301 https://$host$request_uri;
    }
}
```

---

## 4. Commands and what you should test

### Test HTTP to HTTPS redirect with Caddy

```bash
# Test that Caddy redirects HTTP to HTTPS
curl -v http://app1.localhost/ 2>&1 | head -15

; Expected output (relevant parts):
< HTTP/1.1 308 Permanent Redirect
< Location: https://app1.localhost/
< Content-Length: 0
< Date: Wed, 28 Oct 2026 11:30:00 GMT
< Server: Caddy
< 
*   Removing fprintf() fragment
*   Server doesn't support CONTINUE, continuing anyway
*   HTTP/2 switch on error or redirect
*   found 308 (use '<http://app1.localhost/>')
* Reusing existing connection! Could reuse <unconnected>! connecting to app1.localhost:443!
*   found 308 (use '<http://app1.localhost/>')
*   SSL or SSH failure for cert... ignoring (use --insecure to use anyway)
> GET https://app1.localhost/ HTTP/1.1
> Host: app1.localhost
```

; **308** is the status code - permanent redirect preserving the method
; **Location:** shows where it's redirecting to (HTTPS version)

### Test Caddy www to non-www redirect

```bash
# Test www to non-www redirect (if configured)
curl -v http://www.app1.localhost/ 2>&1 | head -10

; Expected: 301 or 302 redirect to non-www version
```

### Test Nginx HTTP to HTTPS redirect

```bash
# Test through Nginx (port 8080)
curl -v http://localhost:8080/ 2>&1 | head -10

; Expected: 
< HTTP/1.1 301 Moved Permanently
< Location: https://localhost:8080/
< Content-Length: 0
< Date: Wed, 28 Oct 2026 11:30:00 GMT
< Server: nginx
```

### Test redirect status codes

```bash
# Check just the status code
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/ 2>/dev/null

; Expected: 301 (permanent) or 302 (temporary) or 308 (permanent, method-preserving)

curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/ 2>/dev/null

; Expected: 301 or 302 from Nginx
```

### Test redirect with curl -L (follow redirects)

```bash
# Follow redirects automatically
curl -L -s http://app1.localhost/ 2>&1 | head -3

; Expected: Will follow the 301/302/308 and show the final HTTPS content

# Don't follow redirects (show just the redirect)
curl -o /dev/null -s -w "%{http_code}" -D - http://app1.localhost/ 2>/dev/null | head -10

; Expected: Shows the redirect status code and Location header
```

### Test redirect loop detection

```bash
# Browers show "too many redirects" error
; This happens when:
; - HTTP→HTTPS→HTTP loop
; - www↔non-www loop
; - Conflicting redirect rules

; In Caddy, check logs for redirect loops
docker compose logs caddy 2>&1 | grep -i "redirect\|loop"

; Expected: Should show no redirect loop errors in proper config
```

### Test Nginx redirect configuration syntax

```bash
; Test Nginx config syntax
nginx -t -c /etc/nginx/nginx.conf 2>&1

; Expected: "the configuration file /etc/nginx/nginx.conf syntax is ok"
```

### Compare Caddy vs Nginx redirect behavior

```bash
# Both should redirect, but with different status codes by default

echo "=== Caddy redirect ==="
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/

echo ""
echo "=== Nginx redirect ==="
curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/

; Expected: Both return 301 or 308, depending on config
```

### Test permanent vs temporary redirect distinction

```bash
# 301/308 are cached by browsers; 302/307 are not (as reliably)

# Test that a 301 is cached (conceptual - after first redirect,
; subsequent direct HTTP requests may go straight to HTTPS)
; Browsers remember 301/308 permanently
; Browsers may forget 302/307 after a session

; In practice:
; - Use 301/308 for permanent moves (HTTP→HTTPS, domain changes)
; - Use 302/307 for temporary moves (coming soon, A/B testing)
```

---

## 5. In a real multi-tenant SaaS

### Redirect HTTP to HTTPS for SaaS tenants:

```caddyfile
# Redirect all HTTP traffic to HTTPS for each tenant

store-a.example.com {
  # Caddy automatically handles this with the `tls` directive
  # But explicit redirect ensures even HTTP requests get HTTPS
  
  # Redir is typically not needed when using automatic HTTPS,
  # but here's the pattern:
  redir https://{host}{uri} 301
  
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  reverse_proxy app-a:3000
}
```

### Redirect www to non-custom domain (or reverse):

```caddyfile
# SaaS: redirect naked domain to custom domain (or reverse)

# Redirect example.com → store.example.com (not typical SaaS pattern)
# More typical: redirect www.store.example.com → store.example.com

example.com {
  redir https://store.example.com{uri} 301
}

# Or reverse: redirect store.example.com → www.store.example.com
store.example.com {
  redir https://www.store.example.com{uri} 301
}
```

### Redirect old domains to new SaaS tenant domains:

```caddyfile
# Redirect legacy domains to current SaaS domains

# If a merchant previously used old-domain.com, redirect to their new domain
old-domain.com {
  redir https://store.example.com{uri} 301
}

# Multiple legacy domains → single current domain
legacy1.com {
  redir https://store.example.com{uri} 301
}

legacy2.com {
  redir https://store.example.com{uri} 301
}
```

### Redirect paths within SaaS:

```caddyfile
# Redirect old API paths to new ones

# If you change your API structure
/old-api/* {
  redir /new-api{uri} 301
}

# Or with versioning
/v1/* {
  redir /v2{uri} 301
}
```

### Preserving query parameters in redirects:

```caddyfile
# Redirect while preserving query strings

# {uri} in Caddy includes the path AND query string
# No extra configuration needed

# Example: redirect /old-page?foo=bar to /new-page?foo=bar
/old-page {
  redir /new-page{uri} 301
}

; The {uri} automatically includes ?foo=bar, so the redirect preserves it
```

### Nginx redirect with query parameters:

```nginx
# Nginx preserves request_uri automatically
return 301 https://$host$request_uri;

; $request_uri includes the path and query string (e.g., /page?foo=bar)
; No extra configuration needed to preserve query parameters
```

### Redirect checklist for SaaS onboarding:

```text
# When a new merchant signs up with a custom domain:

1. ✓ Add domain to SaaS dashboard
2. ✓ Show DNS instructions (CNAME record pointing to proxy domain)
3. ✓ Merchant adds DNS record at their registrar
4. ✓ Verify domain resolves to your proxy (using `dig`)
5. ✓ Set up HTTPS (Caddy automatic HTTPS or pre-provisioned cert)
6. ✓ Configure redirect HTTP→HTTPS (Caddy does this automatically)
7. ✓ Configure www ↔ non-www redirect (choose one, redirect the other)
8. ✓ Test the full flow: domain → proxy → HTTPS → app
9. ✓ Verify tenant resolution from Host header
10. ✓ Document the domain configuration for the merchant
```

---

## 6. When to use it and when NOT to

**Use redirect knowledge when**:
- Configuring HTTP→HTTPS redirection
- Setting up www ↔ non-www domain preferences
- Migrating domains or changing URL structures
- Debugging "too many redirects" errors
- Planning SaaS domain onboarding flow

**NOT to create unnecessary redirects**:

- Don't redirect if you don't need to (some setups serve both HTTP and HTTPS)
- Don't create redirect chains (A→B→C→D) - keep it direct (A→D)
- Don't ignore redirect loop risks (test thoroughly before deploying)
- Don't use 301 for temporary situations (use 302/307/308 instead)

---

## 7. Common mistakes

- **Creating redirect loops**: `http→https→http` or `www→non-www→www`. Always test the full chain.
- **Using 301 when you mean 302**: 301 is cached by browsers; if you later want to change, users may still go to the old URL. Use 302/307 for temporary.
- **Redirect chains**: A→B→C instead of direct A→C. Each hop adds latency and may break some clients.
- **Forgetting the `Location` header**: A redirect response without `Location` won't work (though `return 301 URL` in Nginx or `redir URL` in Caddy handles this).
- **Using 301 for temporary situations**: If you change your mind later, browsers may still redirect to the old URL due to 301 caching.
- **Not preserving query parameters**: Some redirect configs drop `?foo=bar` from the original URL. Caddy's `{uri}` automatically preserves it; Nginx's `$request_uri` also preserves it.
- **Redirecting the wrong domain**: Redirecting `example.com` when you meant `www.example.com`, or vice versa.
- **Ignoring SEO implications**: 301 redirects pass "SEO juice" to the new URL; 302/307 do not. Use 301 for permanent moves if concerned about SEO.

---

## 8. Try it yourself

**Exercise**: Test redirects and understand the different status codes.

```bash
# 1. Test Caddy HTTP to HTTPS redirect
echo "=== Caddy HTTP to HTTPS ==="
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/

; Expected: 301 or 308 (permanent redirect to HTTPS)

# 2. Test with curl -L (follow the redirect)
echo "=== Caddy redirect followed ==="
curl -L -s http://app1.localhost/ 2>&1 | head -3

; Expected: Shows the HTTPS content after following the redirect

# 3. Test with curl -D (show headers, don't follow)
echo "=== Caddy redirect headers ==="
curl -o /dev/null -s -w "%{http_code}" -D - http://app1.localhost/ 2>/dev/null | head -10

; Expected: Shows 301/308 status and Location: https://...

# 4. Test Nginx HTTP to HTTPS redirect
echo "=== Nginx HTTP to HTTPS ==="
curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/

; Expected: 301 (permanent redirect)

# 5. Test redirect status code distinction
; 301 = Moved Permanently (cached by browsers)
; 302 = Found (temporary, original behavior)
; 303 = See Other (method-specific, always GET)
; 307 = Temporary Redirect (preserves method)
; 308 = Permanent Redirect (preserves method)

; In proxy-learn, Caddy uses 308 by default for HTTP→HTTPS

# 6. Test that query parameters are preserved
echo "=== Redirect with query params ==="
curl -o /dev/null -s -w "%{http_code}" -D - "http://app1.localhost/?foo=bar" 2>/dev/null | head -10

; Expected: 301/308 and Location should include ?foo=bar (Caddy auto-preserves)

# 7. Test Nginx redirect configuration
echo "=== Nginx redirect config ==="
grep -n "return 301\|return 302\|return 308" /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/nginx/nginx.conf 2>/dev/null || echo "No explicit redirects in current Nginx config"

# 8. Verify current redirect setup in proxy-learn
echo "=== Current proxy-learn redirect setup ==="
echo "Caddyfile has HTTP server block: $(grep -c 'localhost:80' /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile)"
echo "Caddy automatically handles HTTP→HTTPS with automatic HTTPS enabled"

; Expected: Caddy handles HTTP→HTTPS automatically when using `tls` directive

# Cleanup: No cleanup needed - these commands only test redirect concepts.
```

**Hint**: Key differences between Caddy and Nginx redirects:

| Aspect | Caddy | Nginx |
|--------|-------|-------|
| **Default redirect code** | 308 (permanent, method-preserving) | 301 (permanent) by default with `return 301` |
| **Auto HTTP→HTTPS** | Built-in with `tls` directive | Manual with `return 301 https://...` |
| **www ↔ non-www** | `redir https://example.com{uri} 301` | `return 301 https://example.com$request_uri` |
| **Query parameter preservation** | `{uri}` auto-preserves | `$request_uri` auto-preserves |
| **Conditional redirects** | `handle` blocks with `if` | `if` directives (limited in nginx) |
| **Config simplicity** | `redir URL code` one line | `return 301 URL` or separate server block |

**Cleanup**: No cleanup needed - these commands only test the running proxy-learn setup and concepts.

---

## Next

[[12-custom-domains-saas]] - Learn about custom domains for a SaaS, end to end: the merchant adds a domain, we show DNS instructions, we verify ownership, the proxy serves it, a certificate is issued, and the app resolves the tenant from the Host header. Also compare with one subdomain per tenant and a wildcard certificate.