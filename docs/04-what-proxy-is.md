# docs/04-what-proxy-is.md

## 1. Simple explanation (like I'm 7)

A **proxy** is like a middleman or a receptionist. Instead of talking directly to the person you want, you talk to the proxy, and the proxy talks to the real person for you.

### Reverse proxy (what you'll use most)
Think of a building with many offices. You (the browser) don't go into the building directly. Instead, you go to the **lobby/reception**. The receptionist knows which office you need to visit, and they send you there.

- **You** → **Reverse Proxy** → **Web server (your app)**
- The reverse proxy sits **in front** of your servers
- It receives requests from browsers and forwards them to the right backend

### Forward proxy
Think of you wanting to visit a website that's blocked at your school or work. You ask a **proxy server** to fetch the website for you, and it brings it back. The website doesn't know it's you - it thinks it's the proxy.

- **You** → **Forward Proxy** → **Internet/website**
- The forward proxy sits **in front** of the client (you)
- It fetches content from the internet on your behalf

---

## 2. Real name

**Proxy** is a server that acts as an intermediary between a client (browser) and another server (web application). There are two main types:

### Reverse Proxy (the kind you'll use)

A reverse proxy sits **in front of** one or more web servers and forwards client requests to them. It's called "reverse" because it's the opposite of a forward proxy.

**Key functions**:
- **Load balancing**: Distribute requests across multiple backend servers
- **SSL termination**: Handle HTTPS certificates, decrypt traffic, forward HTTP to backends
- **Caching**: Store recent responses so subsequent requests are faster
- **Security**: Hide backend server IP addresses, filter requests
- **Header manipulation**: Add, remove, or modify headers
- **Compression**: Compress responses before sending to browser
- **Rate limiting**: Limit how many requests a client can make

**Typical architecture**:

```
+-----------+       +------------+       +--------------+
|  Browser  | <-----> | Reverse    | <-----> |  Backend App |
|  (curl)   |       | Proxy      |       |  (Node.js)   |
+-----------+       +------------+       +--------------+
         port 443            port 80        port 3000
```

### Forward Proxy

A forward proxy sits **in front of** clients and makes requests on their behalf to the internet.

**Key functions**:
- **Caching**: Speed up repeated requests to the same websites
- **Anonymity**: Hide the client's real IP address
- **Access control**: Block access to certain websites (school/work networks)
- **Internet access**: Give internal clients access to the internet through one gateway

**Typical architecture**:

```
+-----------+       +------------+       +--------------+
|  Browser  | <-----> | Forward    | <-----> |  Internet    |
|  (you)    |       | Proxy      |       |  (websites)  |
+-----------+       +------------+       +--------------+
```

---

## 3. Config example

### Caddyfile with reverse_proxy (your current setup)

```caddyfile
# This is the core: reverse_proxy forwards to the app backend
app1.localhost {
  # The magic line: forward requests to the Node.js app
  reverse_proxy app:3000
  
  # Additional config (headers, logging, etc.) goes here
  header {
    X-Content-Type-Options "nosniff"
  }
}
```

**What `reverse_proxy app:3000` does**:
- Takes the incoming request (e.g., `GET / HTTP/1.1 Host: app1.localhost`)
- Connects to `app:3000` on the Docker network
- Forwards the request, preserving the `Host` header
- Sends the backend's response back to the browser

### Caddyfile with load balancing (multiple backends)

```caddyfile
# Distribute requests across multiple app instances
app1.localhost {
  # Round-robin: spread requests evenly across all listed backends
  reverse_proxy app-a:3000 app-b:3000 app-c:3000
}
```

### Nginx server block with proxy_pass (your comparison setup)

```nginx
server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        # Forward requests to the Node.js app
        proxy_pass http://app:3000;
        
        # These headers are important for the backend to know the real client IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Nginx with load balancing (round-robin)

```nginx
upstream app_backend {
    # Round-robin balancing across these servers
    server app-a:3000;
    server app-b:3000;
    server app-c:3000;
}

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app_backend;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Commands and what you should see

### Test reverse proxy with Caddy

```bash
# Test that the reverse proxy is working
curl -v https://app1.localhost/

; Expected output (relevant parts):
*   Trying 127.0.0.1:443...
* connected on 127.0.0.1 port 30921
* ALPN, offering h2
* ALPN, server accepted h2
* incoming connection from ::1 port 38566 [TCP keepalive]: keepalive enabled
* schannel: client certificate TLS_UPPER_COMPATIBLE_CIRC
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS change cipher, Change cipher spec (1):
* TLSv1.3 (IN), TLS handshake, Finished (20):
* TLSv1.3 (OUT), TLS change cipher, Change cipher spec (1):
* TLSv1.3 (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 / ...
* ALPN: server accepted h2
* Server certificate:
*   subject: CN=localhost
*   issuer: CN=localhost-CA
*  SSL certificate verified (using default CA bundle)
*  HTTP/2 supported
* Server using TLSv1.3, TLS_AES_128_GCM_SHA256, authenticated_client
*    certificate subject: CN=localhost
*  HTTP/2 server connection
*   server certificate verification SKIPPED (--insecure not used, but cert is trusted via --ca-bundle or system)
* curl_out: (0)
*   server: Caddy
*   date: Wed, 28 Oct 2026 11:00:00 GMT
*   content-type: text/html; charset=utf-8
*   content-length: 228
*   x-content-type-options: nosniff
*   x-frame-options: DENY
*   accept-ranges: bytes
*   etag: "1-1643228112222"
*   last-modified: Wed, 28 Oct 2026 10:18:54 GMT
*   content-encoding: gzip
*   expiry: max-age=31536000
*   strict-transport-security: max-age=31536000; includeSubDomains; preload
*   ...
<HTML>
<H1>Hello from the Node.js app!</H1>
<P>Host header: app1.localhost</P>
```

### Test that Host header is forwarded

```bash
# Check that the backend sees the correct Host header
curl -v -H "X-Real-IP: 1.2.3.4" https://app1.localhost/headers

; Expected output:
<p>Host header: app1.localhost</p>
<p>X-Forwarded-For: 172.23.0.1</p>
<p>Proto: not set</p>
```

### Test Nginx reverse proxy

```bash
# Test through Nginx (HTTP, port 8080)
curl -v http://localhost:8080/

; Expected output (relevant parts):
< X-Frame-Options: DENY
< Referrer-Policy: strict-origin-when-origin-only
< 
<html>
<h1>Hello from the Node.js app!</h1>
<p>Server port: 3000</p>
<p>Host header: localhost</p>
<p>X-Forwarded-For: 172.23.0.1</p>
<p>Proto: not set</p>
```

### Test load balancing (if you had multiple apps)

```bash
# With Caddy reverse_proxy listing multiple backends
curl -s https://app1.localhost/  # Will round-robin across listed apps
```

### Test forward proxy (if configured)

```bash
# Not typically tested in proxy-learn, but would look like:
export http_proxy="http://proxy-host:3128"
curl -v http://example.com/
```

### Key curl -v output fields to understand:

| Field | Meaning |
|-------|---------|
| `* connected on 127.0.0.1 port 30921` | Connection established |
| `> GET / HTTP/1.1` | Request line you sent |
| `> Host: app1.localhost` | Host header you sent |
| `< HTTP/1.1 200 OK` | Status code server responded with |
| `< Server: Caddy` | Server software |
| `< X-Content-Type-Options: nosniff` | Security header |
| `< content-length: 228` | Body size |
| `<  Host header: app1.localhost` | App's response showing the Host header |

---

## 5. In a real multi-tenant SaaS

### Reverse proxy for SaaS custom domains:

```caddyfile
# This is the central reverse proxy for all merchants
*.saaSplatform.com {
  # Route based on the Host header (the merchant's custom domain)
  handle {
    # Match the Host header and route to the right tenant
    route {
      if {host} * "store-a.example.com" {
        reverse_proxy app-a:3000
      }
      if {host} * "store-b.example.com" {
        reverse_proxy app-b:3000
      }
      # Default if no match
      response 404 "No tenant found for this domain"
    }
  }
}
```

### Load balancing for high availability:

```caddyfile
# Distribute traffic across multiple app instances for one tenant
tenant-a.example.com {
  # Round-robin across 3 app servers
  reverse_proxy app-a:3000 app-b:3000 app-c:3000
}
```

### Header manipulation for tenant awareness:

```caddyfile
# Add a header identifying the tenant from the Host header
store-a.example.com {
  # Extract the tenant identifier from the Host header
  header {
    X-Tenant-Id "{host}"
  }
  reverse_proxy app-a:3000
}
```

### Forward proxy (rarely needed for SaaS):

Forward proxies are generally **not** used in SaaS custom domain setups because:
- You want to know the real client IP (security/audit)
- You want to terminate SSL at your infrastructure
- You want to enforce security headers
- Forward proxies hide the client, which is the opposite of what you need

---

## 6. When to use it and when NOT to

**Use proxy knowledge when**:
- Setting up a reverse proxy in front of your applications
- Configuring custom domains for SaaS merchants
- Load balancing multiple server instances
- Terminating SSL/TLS (HTTPS)
- Adding security headers (HSTS, CSP, etc.)
- Rate limiting and compression

**NOT to use a forward proxy for SaaS custom domains**:
- Forward proxies are for clients accessing the internet anonymously
- SaaS needs the reverse proxy to know the real client IP
- Never use a forward proxy when you need to see the `Host` header
- Don't expose internal ports (like 3000) to the internet

---

## 7. Common mistakes

- **Exposing the backend port**: Never put `app:3000` as a port directly exposed to the internet. Keep it internal only.
- **Forgetting forwarded headers**: The backend won't see the real `Host` header, `X-Forwarded-For`, or `X-Forwarded-Proto` unless you explicitly set them.
- **Using `proxy_pass http://localhost:3000`** in Docker: This won't work because `localhost` inside a container is the container itself, not the host machine. Use Docker service names instead.
- **No SSL termination**: If you offload HTTPS to the proxy but don't set `X-Forwarded-Proto`, the backend thinks it's HTTP, not HTTPS.
- **Circular proxying**: Don't have Caddy behind Nginx behind Caddy - pick one and stick with it.
- **Missing `host` header in proxy_pass**: The backend may reject requests without a proper `Host` header.

---

## 8. Try it yourself

**Exercise**: Test the reverse proxy and observe how headers are forwarded.

```bash
# 1. Test basic reverse proxy functionality
curl -k https://app1.localhost/

; Expected: You see the app's response with "Host header: app1.localhost"

# 2. Test headers endpoint to see what the proxy forwards
curl -k https://app1.localhost/headers

; Expected: Shows Host, X-Forwarded-For, Proto from the app's perspective

# 3. Compare Caddy vs Nginx behavior
curl -k https://app1.localhost/  # Caddy (HTTPS)
curl http://localhost:8080/      # Nginx (HTTP)

; Expected: Both show the app, but Caddy adds TLS/HTTP-2, Nginx is plain HTTP

# 4. Test that the Host header is properly forwarded
# The app should see "app1.localhost", not "localhost" or the container IP
```

**Hint**: If the app shows `Host header: localhost` instead of `app1.localhost`:
1. Check that `proxy_set_header Host $host;` is in the config
2. For Caddy, ensure `reverse_proxy` is used (it automatically forwards the Host header)
3. Verify the Docker network is connecting correctly

**Cleanup**: No cleanup needed - these commands only test the running setup.

---

## Next

[[05a-tls-https]] - Learn about TLS and HTTPS: certificates, certificate authorities, the chain of trust, the handshake, SNI, and HSTS.