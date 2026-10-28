# docs/03-http-basics.md

## 1. Simple explanation (like I'm 7)

HTTP is how computers talk to each other to show web pages. Here's what happens:

1. **Your browser sends a request**: "Hello! I want the page at `http://app1.localhost/`"
2. **The most important part is the `Host` header**: It says "I'm looking for `app1.localhost`". Without this, the server wouldn't know which website you want (especially when many websites share one IP address).
3. **The server answers**: It sends back a status code:
   - **200** = "OK, here's the page you wanted"
   - **301/302** = "This page moved, go to this new address instead" (redirect)
   - **404** = "I can't find the page you're looking for"
   - **500** = "Something went wrong on the server"
4. **If the page moved**, the server says "Go to this new URL instead" - that's a **redirect**.

Think of it like sending a letter: the `Host` header is the address on the envelope, and the status code is the reply - "come in", "go somewhere else", or "not found".

---

## 2. Real name

**HTTP (HyperText Transfer Protocol)** is the foundation of data communication for the World Wide Web. It defines how messages are formatted and transmitted, and what web browsers and servers should do in response to various commands.

**Key concepts**:

| Concept | Description |
|---------|-------------|
| **`Host` header** | Tells the server which domain name is being requested. Essential for virtual hosting (many domains on one IP). |
| **Status codes** | 3-digit numbers returned by the server. Categories: |
| | **1xx**: Informational (rare) |
| | **2xx**: Success (200 = OK) |
| | **3xx**: Redirection (301 = permanent, 302 = temporary) |
| | **4xx**: Client error (404 = Not Found, 403 = Forbidden) |
| | **5xx**: Server error (500 = Internal Error, 502 = Bad Gateway) |
| **Redirect** | A response (3xx) that tells the browser to go to a different URL. Can be permanent (301) or temporary (302/308). |
| **`Location` header** | In a redirect response, tells the browser where to go next. |
| **Virtual hosting** | serving multiple websites from one IP address using the `Host` header to distinguish them. |

**Real-world example**:

```http
; Request from browser (what curl sends):
GET / HTTP/1.1
Host: app1.localhost
User-Agent: curl/8.18.0
Accept: */*

; Response from server (200 OK):
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1234
Date: Wed, 28 Oct 2026 10:45:00 GMT
Server: Caddy

; Response from server (301 redirect):
HTTP/1.1 301 Moved Permanently
Location: https://app1.localhost/
Content-Length: 0
Date: Wed, 28 Oct 2026 10:45:00 GMT
Server: Caddy
```

---

## 3. Config example

### Caddyfile HTTP basics (already in your setup)

Your Caddyfile already handles HTTP basics:

```caddyfile
# Caddy automatically adds the Host header handling
app1.localhost {
  # reverse_proxy will forward the Host header by default
  reverse_proxy app:3000
  
  # You can customize headers
  header {
    X-Content-Type-Options "nosniff"
  }
}
```

### Nginx server block (already in your setup)

```nginx
server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
        
        # Nginx passes the Host header by default
        # But you can customize it:
        proxy_set_header Host $host;
    }
}
```

### Testing with curl -v (what you should see)

```bash
# Basic GET request
curl -v http://app1.localhost/

; Expected output (relevant parts):
*   Trying 127.0.0.1:80...
* TCP_NODELAY set
* connected on 127.0.0.1 port 30729
* ALPN, offering h2
* ALPN, server accepted http1.1
* TCP connection set
> GET / HTTP/1.1
> Host: app1.localhost
; <-- This is the Host header you set
> User-Agent: curl/8.18.0
> Accept: */*
; 
< HTTP/1.1 200 OK
; <-- Server response
< Date: Wed, 28 Oct 2026 10:45:00 GMT
< Server: Caddy
< X-Content-Type-Options: nosniff
< X-Frame-Options: DENY
< Content-Length: 228
< 
* Connection #0 to host app1.localhost left intact
< HTTP/1.1 200 OK
<html>
<h1>Hello from the Node.js app!</h1>
<p>Host header: app1.localhost</p>
```

```bash
# Request that gets a redirect
curl -v -L http://app1.localhost/

; Expected - will follow the redirect to HTTPS:
*   Trying 127.0.0.1:80...
* connected on 127.0.0.1 port 30812
> GET / HTTP/1.1
> Host: app1.localhost
< HTTP/1.1 308 Permanent Redirect
< Location: https://app1.localhost/
< Content-Length: 0
< Date: Wed, 28 Oct 2026 10:45:00 GMT
< Server: Caddy
< 
*   Removing fprintf() fragment
*   <http://app1.localhost/> ~no body in redirect
*   Server doesn't support CONTINUE, continuing anyway
*   HTTP/2 switch on error or redirect
*   found 308 (use '<http://app1.localhost/>')
* Reusing existing connection! Could reuse <unconnected>! connecting to app1.localhost:443!
*   found 308 (use '<http://app1.localhost/>')
*   SSL or SSH failure for cert... ignoring (use --insecure to use anyway)
> GET https://app1.localhost/ HTTP/1.1
> Host: app1.localhost
```

### Status code reference:

| Code | Meaning | When you'd see it |
|------|---------|-------------------|
| **200** | OK | Normal page load |
| **301** | Moved Permanently | HTTP→HTTPS redirect, www→non-www |
| **302/308** | Found/Temporary Redirect | Temporary redirect, redirect loops |
| **400** | Bad Request | Malformed request, missing Host header |
| **404** | Not Found | Path doesn't exist on server |
| **403** | Forbidden | Access denied, wrong permissions |
| **500** | Internal Server Error | Server crash, code error |
| **502** | Bad Gateway | Upstream server (your app) is down |

---

## 5. In a real multi-tenant SaaS

### Host header routing:

When a SaaS has multiple merchants on one proxy, the `Host` header is how the proxy knows which merchant to serve:

```http
; Merchant A's request:
GET / HTTP/1.1
Host: store-a.example.com

; Merchant B's request:
GET / HTTP/1.1
Host: store-b.example.com

; Both go to the same proxy, but the proxy looks at the Host header
; and routes to the correct tenant's data
```

### Caddy handle blocks for tenant routing:

```caddyfile
app1.localhost {
  # Route based on Host header
  handle {
    # If Host matches merchant A
    route {
      if {host} match "store-a.example.com" {
        reverse_proxy app-a:3000
      }
    }
    
    # If Host matches merchant B
    route {
      if {host} match "store-b.example.com" {
        reverse_proxy app-b:3000
      }
    }
    
    # Default: show 404 or default tenant
    response 404 "Tenant not found"
  }
}
```

### Redirect scenarios for SaaS:

1. **HTTP to HTTPS**: Redirect all HTTP traffic to HTTPS
   ```caddyfile
   localhost:80 {
     redirect https://{host}{uri}
   }
   ```

2. **www vs non-www**: Redirect `www.example.com` to `example.com` or vice versa
   ```caddyfile
   www.example.com {
     redirect https://example.com{uri}
   }
   ```

3. **Custom domain to tenant**:
   ```caddyfile
   store-a.example.com {
     reverse_proxy app-a:3000
   }
   store-b.example.com {
     reverse_proxy app-b:3000
   }
   ```

---

## 6. When to use it and when NOT to

**Use HTTP basics knowledge when**:
- Configuring redirects (HTTP→HTTPS, www→non-www)
- Debugging "not found" or "redirect loop" errors
- Setting up virtual hosting for multiple domains
- Configuring proxy headers (Host, X-Forwarded-Proto)

**NOT to skip security**:
- Never disable the Host header check if you have multiple domains
- Always use HTTPS (301 redirect from HTTP to HTTPS)
- Never ignore 404/403 status codes in production

---

## 7. Common mistakes

- **Missing Host header**: Some servers reject requests without a valid `Host` header (HTTP/1.1 requirement)
- **Redirect loops**: `http→https→http` or `www→non-www→www`. Check your Caddyfile/Nginx config.
- **301 vs 302**: 301 is cached by browsers; use 302/308 for temporary redirects or Caddy will remember the 301
- **Forgetting the `Location` header**: A redirect response must have a `Location` header, or the browser won't know where to go
- **Status code 400**: Missing or invalid Host header can cause 400 Bad Request
- **Ignoring the `Host` header in logging**: Makes it hard to debug which tenant is which

---

## 8. Try it yourself

**Exercise**: Test HTTP basics with curl and observe the differences.

```bash
# 1. Basic GET with explicit Host header
curl -v -H "Host: app1.localhost" http://localhost:8080/

; Expected: 200 OK, Host header passed through

# 2. Request without Host header (may get 400)
curl -v http://localhost:8080/

; Expected: Possibly 400 Bad Request (HTTP/1.1 requires Host)

# 3. Test redirect - force HTTP→HTTPS
curl -v -L http://app1.localhost/

; Expected: 308 redirect, then 200 on HTTPS version

# 4. Check the response status code only
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/

; Expected: 200

# 5. Check redirect status
curl -o /dev/null -s -w "%{http_code}" http://app1.localhost/ 2>/dev/null

; Expected: 308 (if Caddy is configured for redirect)
```

**Hint**: If you see `400 Bad Request`:
1. Check that the Host header is properly set
2. Make sure Caddy/Nginx is running
3. Verify the `/etc/hosts` entry resolves correctly

**Cleanup**: No cleanup needed - these commands only test HTTP responses.

---

## Next

[[04-what-proxy-is]] - Learn about forward proxy vs reverse proxy, why they exist, and load balancing.