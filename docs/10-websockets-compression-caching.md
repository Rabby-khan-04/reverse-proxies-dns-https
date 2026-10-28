# docs/10-websockets-compression-caching.md

## 1. Simple explanation (like I'm 7)

**WebSockets** let computers have a two-way conversation that stays connected, unlike regular HTTP where each request opens and closes the connection. Think of it like a phone call instead of sending letters back and forth.

**Compression** makes web pages smaller so they load faster. It's like vacuum-packing your clothes - everything fits in a smaller space.

**Caching** is like having a copy of something so you don't need to get it again. If your friend asks "what's for lunch?" and you already told them, you just say "pizza again" instead of explaining the whole menu.

**Rate limiting** is like a nightclub bouncer - "you've had enough, wait a bit before coming back in." It prevents too many requests from one person.

**Request size limits** are like a mailbox size limit - "if the envelope is too big, I won't accept it." Prevents someone from sending huge files that could crash the server.

**Timeouts** are like "I'll wait 30 seconds and then give up." Prevents waiting forever if something hangs.

---

## 2. Real name

**WebSockets** - A persistent, two-way communication channel over a single TCP connection. Upgrades from HTTP/1.1 using the `Upgrade: websocket` header and `Connection: Upgrade` headers.

**HTTP compression** - Reducing the size of HTTP responses using algorithms like gzip, deflate, or brotli. Reduces bandwidth and speeds up page loading.

**Caching** - Storing responses so subsequent requests can be served from the cache instead of the backend. HTTP caching uses headers like `Cache-Control`, `ETag`, and `Last-Modified`.

**Rate limiting** - Controlling the rate of requests a client can make to a service. Prevents abuse, protects against DDoS, and ensures fair resource allocation.

**Request body size limits** - Maximum size of request bodies that a proxy will accept. Prevents oversized uploads from consuming resources.

**Timeouts** - Maximum time a proxy will wait for a response from the backend before giving up and returning an error.

---

## 3. Config example

### Caddy WebSocket support (your current setup)

Caddy supports WebSockets natively with `reverse_proxy` - no special config needed:

```caddyfile
# WebSocket support works automatically with Caddy's reverse_proxy
# If the backend supports WS, Caddy will upgrade the connection

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # WebSocket upgrade is automatic - just use reverse_proxy
  # Clients can connect via: ws://app1.localcast/ws or wss://app1.localcast/ws
  reverse_proxy app:3000
}
```

**How to test WebSockets with Caddy**:

```bash
# Using curl (limited WS support)
curl -N -ws "wss://app1.localcast/ws"  # Conceptual

; Better: use a WebSocket client like wscat or the browser console

# Browser console test:
; const ws = new WebSocket("wss://app1.localhost/ws");
; ws.onmessage = (event) => console.log(event.data);
; ws.send("hello");
```

### Nginx WebSocket support (with configuration)

Nginx requires explicit WebSocket configuration:

```nginx
server {
    listen 80;
    server_name app1.localhost;
    
    location /ws/ {
        # Proxy WebSocket upgrades
        proxy_pass http://app:3000;
        
        # WebSocket-specific headers and upgrades
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Socket timeouts
        proxy_read_timeout 86400;  # 24 hours for WebSocket
        proxy_send_timeout 86400;
    }
}
```

### Caddy compression (automatic)

Caddy enables compression by default for suitable content types:

```caddyfile
# Caddy compresses HTML, CSS, JS, and other text formats automatically
app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Caddy automatically uses brotli/gzip compression
  # No special config needed - "just works"
  
  reverse_proxy app:3000
}
```

### Nginx compression configuration:

```nginx
# Enable gzip compression in Nginx
gzip on;
gzip_disable "msie6";  # Don't compress for old IE
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;  # Compression level (1-9, default 6)
gzip_buffers 16 8k;
gzip_http_version 1.1;
gzip_types text/plain text/css application/json application/javascript application/x-font-ttf application/xml+rss text/xml;

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # Compression headers passed through
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy caching configuration:

```caddyfile
# Caddy caching configuration
app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Cache static assets for 1 hour, dynamic content for 10 seconds
  # Caddy's built-in caching
  # header {
  #   Cache-Control "public, max-age=3600"
  # }
  
  # Or use Caddy's file_server for static assets
  # reverse_proxy app:3000
  
  # For API routes, caching can be controlled via headers
  # header {
  #   Cache-Control "public, max-age=10"
  # }
  
  reverse_proxy app:3000
}
```

### Nginx caching (proxy_cache):

```nginx
# Nginx proxy caching
proxy_cache_path /tmp/cache levels=1:2 keys_zone=my_cache:10m max_size=100m inactive=60m use_temp_path=direct;

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # Apply caching
        proxy_cache my_cache;
        proxy_cache_valid 200 302 30m;
        proxy_cache_valid any 10s;
        proxy_cache_key $host$request_method$request_uri;
        
        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy request size limits:

```caddyfile
# Caddy request body size limit
# Default is 100MB, can be reduced

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Limit request body size to 10MB
  # Requests larger than this will return 413 Payload Too Large
  # body_limit 10MB
  
  reverse_proxy app:3000
}
```

### Nginx request size limits:

```nginx
# Limit request body size
client_max_body_size 10M;  # 10 megabytes

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        client_max_body_size 10M;  # Also in location block if needed
    }
}
```

### Caddy timeouts configuration:

```caddyfile
# Caddy timeout configuration
# (Caddy handles timeouts internally, generally "just works")

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Caddy's default timeouts are reasonable:
  # - Read timeout: 30 seconds (can be adjusted)
  # - Write timeout: 30 seconds
  # - Idle timeout: depends on connection handling
  
  reverse_proxy app:3000
}
```

### Nginx timeouts configuration:

```nginx
# Timeout settings
proxy_read_timeout 300;     # 5 minutes - read response from backend
proxy_send_timeout 300;     # 5 minutes - write request to backend
proxy_connect_timeout 90;   # 90 seconds - connect to backend

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # All the timeout settings above
        proxy_read_timeout 300;
        proxy_send_timeout 300;
        proxy_connect_timeout 90;
    }
}
```

### Caddy rate limiting:

```caddyfile
# Caddy rate limiting (using http.handles or global config)

# Global rate limiting (all routes)
# Caddy has experimental rate limiting via plugins/middleware
# For now, use application-level rate limiting

# Or via Caddy's rate limit middleware (v2.6+)
# import rate_limit

app1.localhost {
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Rate limit per IP (conceptual - Caddy has rate limiting via plugins)
  # This is typically done in the application or via a Caddyfile plugin
  
  reverse_proxy app:3000
}
```

### Nginx rate limiting:

```nginx
# Rate limiting per IP address
limit_req_zone $binary_remote_addr zone=limit_per_ip:10 rate=1r/s;

server {
    listen 80;
    server_name app1.localhost;
    
    # Apply rate limiting to all requests
    limit_req zone=limit_per_ip;
    
    location / {
        proxy_pass http://app:3000;
    }
    
    # Or limit per specific route
    location /api/ {
        limit_req zone=limit_per_ip;
        proxy_pass http://app:3000;
    }
}
```

---

## 4. Commands and what you should test

### Test WebSocket connectivity (conceptual - proxy-learn setup)

```bash
# WebSocket testing in proxy-learn
; The Node.js app doesn't have a WS endpoint, but you can understand the config

# Caddy WS config (no special config needed):
; Just use reverse_proxy and WebSockets "just work"

# Nginx WS config (needs explicit config):
; Must set Upgrade and Connection headers

# Test with a real WebSocket client (outside proxy-learn):
; npm install -g wscat  # install WebSocket client
; wscat -c wss://app1.localhost/ws  # connect and test
```

### Test Caddy compression

```bash
# Check if Caddy is compressing responses
curl -v -k https://app1.localhost/ 2>&1 | grep -E "content-encoding|transfer-encoding"

; Expected: May show "content-encoding: gzip" or "content-length" (if not compressed)

# Test with Accept-Encoding header to force compression
curl -v -k -H "Accept-Encoding: gzip" https://app1.localhost/ 2>&1 | head -5

; Expected: May show compressed response if Caddy decides to compress
```

### Test Nginx compression

```bash
# Check Nginx gzip compression
curl -v -H "Accept-Encoding: gzip" http://localhost:8080/ 2>&1 | grep -i "content-encoding"

; Expected: "content-encoding: gzip" if Nginx is configured to compress
```

### Test caching headers

```bash
# Check cache-control headers
curl -I -k https://app1.localhost/ 2>&1 | grep -i "cache-control"

; Expected: Cache-Control header if configured, or no header (Caddy/Nginx default)

# Test with Nginx proxy_cache
; Conceptual - not typically tested in proxy-learn
; Would check: X-Cache: HIT or MISS from the proxy_cache directive
```

### Test request size limits

```bash
# Test with a large request body (conceptual)
; Create a large payload and send it
; Should get 413 Payload Too Large if exceeding the limit

# With Caddy (default 10MB limit):
; Generate a >10MB POST request
; Should receive 413 error if exceeding limit

# With Nginx:
curl -v -X POST -d "$(python3 -c "print('x'*5000000)')" http://localhost:8080/ 2>&1 | head -5

; Expected: May show 413 if exceeding client_max_body_size
```

### Test timeouts

```bash
# Test timeout behavior (conceptual)
; Start the app, then intentionally slow it down
; Observe if the proxy returns a timeout error rather than hanging forever

# Nginx timeout test (conceptual):
; Configure proxy_read_timeout 1s;
; Make a slow request
; Should get 504 Gateway Timeout after 1 second

# Caddy timeout (conceptual):
; Caddy's default timeouts are generally appropriate
; Typically no manual configuration needed
```

### Test rate limiting

```bash
# Test rate limiting with curl (conceptual)
; Too many rapid requests should trigger rate limiting
; Caddy/Nginx should return 503 or 429

# Nginx rate limiting test:
; while true; do curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/; done
; After ~10 requests per second, should start getting 503

# Caddy rate limiting (conceptual):
; Caddy has rate limiting via plugins/middleware
; Would need to configure and test separately
```

### Test WebSocket upgrade with Caddy

```bash
# Verify Caddy passes through WebSocket upgrades
; The key is the "Upgrade" and "Connection" headers

curl -v -k https://app1.localcast/ 2>&1 | grep -i "upgrade\|connection"

; Expected: Caddy should handle WS upgrades transparently
; May not show in regular curl output since curl doesn't support WS well
```

### Compare Caddy vs Nginx feature support

```bash
# Feature matrix comparison

; Feature               Caddy         Nginx
; ---------             -----         ----
; WebSocket support     Automatic     Explicit config
; Compression         Automatic     gzip directive
; Caching             Built-in      proxy_cache directive
; Rate limiting       Plugins       Built-in (limit_req)
; Request size limits body_limit  client_max_body_size
; Timeouts            Automatic     proxy_read_timeout etc.
; Config simplicity   Caddyfile     nginx.conf (complex)
```

---

## 5. In a real multi-tenant SaaS

### WebSockets for SaaS real-time features:

```caddyfile
# Caddy with WebSocket support for SaaS real-time dashboards

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # WebSocket endpoint for real-time updates
  # Caddy handles the WS upgrade automatically
  reverse_proxy app-a:3000
  
  # The backend (Node.js with socket.io or similar) handles the WS logic
  # Caddy just passes the upgrade through
}
```

### Compression for SaaS performance:

```caddyfile
# Caddy compression for SaaS (automatic, but can be configured)

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Caddy automatically compresses:
  # - HTML responses
  # - CSS files
  # - JavaScript files
  # - JSON responses (if content-type matches)
  
  # Optional: customize compression level
  # gzip_comp_level 9  # Maximum compression
  
  reverse_proxy app-a:3000
}
```

### Caching strategy for SaaS:

```caddyfile
# Different caching for different routes

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Cache API responses for 30 seconds (short, dynamic content)
  # Cache static assets for 1 day (long, rarely changes)
  
  # Caddy header-based caching
  # header {
  #   Cache-Control "public, max-age=30"
  # }
  
  # Or for specific routes:
  # reverse_proxy app-a:3000
  
  # API routes might not be cached, but static assets should be
}
```

### Rate limiting for SaaS tenant protection:

```caddyfile
# Per-tenant rate limiting concept

# Caddy doesn't have built-in per-tenant rate limiting in the basic config,
# but the application can use the forwarded X-Forwarded-For to rate limit

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Rate limiting is typically application-level
  # The backend can check X-Forwarded-For and enforce limits
  
  # Or use Caddy plugins (rate limit middleware)
  # reverse_proxy app-a:3000
  
  # Or at the nginx level (if using Nginx):
  # limit_req zone=limit_per_ip;
}
```

### Request size limits for SaaS uploads:

```caddyfile
# Limit upload sizes for SaaS

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Limit request body to 5MB for file uploads
  # body_limit 5MB  # Caddy conceptual
  
  # Or at the application level if Caddy doesn't handle it
  reverse_proxy app-a:3000
}
```

### Timeout settings for SaaS WebSockets:

```caddyfile
# WebSocket timeout configuration

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # WebSockets can have long-lived connections
  # Caddy's default timeouts should handle most cases
  # But you can configure application-level keep-alive
  
  reverse_proxy app-a:3000
  
  # The Node.js app manages WebSocket connection lifecycle
  # Caddy just passes the upgrade through
}
```

### Caching and freshness for SaaS content:

```caddyfile
# Cache-control headers for SaaS

store-a.example.com {
  tls /etc/caddy/certs/store-a-cert.pem /etc/caddy/certs/store-a-key.pem
  
  # Different cache times for different content types
  # HTML: no cache (always fresh)
  # CSS/JS: cache for 1 day
  # API responses: cache for 30 seconds
  
  # Caddy can set these via header blocks
  # header {
  #   Cache-Control "public, max-age=86400"  # 1 day for static
  # }
  
  # Or per-route via reverse_proxy configuration
  reverse_proxy app-a:3000
}
```

---

## 6. When to use it and when NOT to

**Use proxy advanced features knowledge when**:
- Supporting WebSocket connections (real-time chat, dashboards, live updates)
- Optimizing performance with compression and caching
- Protecting against abuse with rate limiting
- Setting request size limits to prevent resource exhaustion
- Configuring timeouts to prevent hanging connections

**NOT to skip WebSocket proxy config**:

- Never assume WebSocket "just works" through any proxy without verification
- Caddy handles WS automatically; Nginx requires explicit `upgrade` header config
- Never set unreasonably short timeouts (users will experience disconnects)
- Never set request size limits too low (legitimate uploads will fail)
- Never disable caching entirely without understanding the trade-offs (freshness vs performance)

---

## 7. Common mistakes

- **Forgetting WebSocket upgrade headers in Nginx**: Without `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"`, WebSocket connections will fail with 400/502 errors in Nginx. Caddy handles this automatically.
- **Setting compression level too high**: Compression ratio improves with higher levels, but CPU usage increases dramatically. Level 6 is a good balance. Level 9 may cause performance issues.
- **Caching sensitive content**: Caching login pages, API responses with user data, or HTTPS responses can security vulnerabilities. Always use `Cache-Control: no-cache` or `no-store` for sensitive content.
- **Rate limiting too aggressively**: If you block legitimate users by accident. Start conservative (e.g., 100 requests/minute) and adjust based on traffic patterns.
- **Request size limits too low**: Legitimate file uploads (profiles, documents) will fail. Consider 1-10MB for API, 10-100MB for file upload endpoints.
- **Timeouts too short**: WebSockets and long-lived connections will be killed prematurely. Default 30-60 seconds is usually appropriate for HTTP, longer for WebSockets.
- **Not handling X-Forwarded-For with rate limiting**: If rate limiting uses `$remote_addr` without considering forwarded headers, all clients behind a proxy will share one rate limit bucket.
- **Ignoring the difference between edge caching and response caching**: Edge caches (CDN) cache closer to the client; response caches (proxy) cache closer to the server. Know which you're configuring.

---

## 8. Try it yourself

**Exercise**: Test advanced proxy features and understand their configuration.

```bash
# 1. Test that Caddy's WebSocket support works (conceptual)
; The proxy-learn app doesn't have a WS endpoint, but you can verify the config
cat /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile

; Expected: Shows `reverse_proxy app:3000` without extra WS config needed

# 2. Test compression with curl
echo "=== Testing Caddy compression ==="
curl -v -k -H "Accept-Encoding: gzip" https://app1.localhost/ 2>&1 | grep -i "content-encoding"

echo ""
echo "=== Testing without Accept-Encoding ==="
curl -v -k https://app1.localhost/ 2>&1 | grep -i "content-encoding"

; Expected: May show different behavior based on Caddy's auto-compress config

# 3. Test request size limits (conceptual)
; Try sending a very large POST body
; Should get 413 if exceeding limits

# 4. Test Nginx WebSocket config (compare with Caddy)
; Nginx requires explicit Upgrade header config
; Caddy does not

# 5. Test caching headers
echo "=== Caddy cache headers ==="
curl -I -k https://app1.localhost/ 2>&1 | grep -i "cache-control"

echo ""
echo "=== Nginx cache headers ==="
curl -I http://localhost:8080/ 2>&1 | grep -i "cache-control"

; Expected: May differ based on configuration

# 6. Test rate limiting concept (no actual limiting in proxy-learn)
; Make rapid requests and observe
; abenchmark or sequential curls

echo "=== Rapid requests to Caddy ==="
for i in {1..5}; do curl -k -s https://app1.localhost/ & done; wait

; Expected: All succeed (no rate limiting in proxy-learn basic config)

# 7. Compare Caddy vs Nginx feature configuration effort

echo "=== Caddy WS config lines ==="
grep -c "reverse_proxy" /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile

echo ""
echo "=== Nginx WS config lines ==="
grep -c "proxy_set_header.*Upgrade" /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/nginx/nginx.conf 2>/dev/null || echo "No WS config in current Nginx setup"

; Expected: Caddy has fewer config lines for WS

# 8. Verify your setup's current feature support
echo "=== Current proxy-learn features ==="
echo "Caddyfile has reverse_proxy: $(grep -c "reverse_proxy" /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/Caddyfile)"
echo "Nginx has proxy_pass: $(grep -c "proxy_pass" /home/sunny/app/nimo/reverse-proxies-dns-https/proxy-learn/nginx/nginx.conf)"

; Expected: Both have 1 reverse_proxy/proxy_pass line
```

**Hint**: Key takeaways about advanced proxy features:

| Feature | Caddy | Nginx |
|---------|-------|-------|
| **WebSocket** | Automatic (`reverse_proxy` passes through) | Explicit config needed (`Upgrade` header) |
| **Compression** | Automatic (brotli/gzip) | `gzip on;` directive |
| **Caching** | Built-in, header-based | `proxy_cache` directive |
| **Rate limiting** | Plugins/experimental | Built-in (`limit_req_zone`) |
| **Request size** | `body_limit` (v2.6+) | `client_max_body_size` |
| **Timeouts** | Automatic, reasonable defaults | Explicit `proxy_read_timeout` etc. |
| **Config simplicity** | Less config, "just works" | More config, more granular control |

**Cleanup**: No cleanup needed - these commands only test the running proxy-learn setup and concepts.

---

## Next

[[11-redirects]] - Learn about HTTP to HTTPS, www vs non-www, and redirect loops.