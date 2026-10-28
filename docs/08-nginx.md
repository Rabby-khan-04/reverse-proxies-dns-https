# docs/08-nginx.md

## 1. Simple explanation (like I'm 7)

**Nginx** (pronounced "engine-x") is a web server that's really good at handling lots of connections at once. It's like a traffic cop for your website.

### Why Nginx is popular:

- **Fast**: Handles many simultaneous connections efficiently
- **Reverse proxy**: Can sit in front of your application servers (like Caddy does)
- **Load balancing**: Can distribute traffic across multiple servers
- **Static file serving**: Good at serving images, CSS, JavaScript
- **Configuration**: Uses `nginx.conf` file with blocks and directives

### Nginx vs Caddy (the big difference):

| Feature | Caddy | Nginx |
|---------|-------|-------|
| **HTTPS config** | Automatic via Let's Encrypt | Manual; need certbot or tls directives |
| **Config format** | Caddyfile (human-readable) | nginx.conf (complex blocks) |
| **Learning curve** | Easier - "just list domain names" | Harder - need to understand blocks |
| **Cert management** | Automatic (automatic HTTPS) | Manual (certbot or provided certs) |
| **Reverse proxy** | `reverse_proxy` directive | `proxy_pass` directive |
| **Rate limiting** | Built-in, easy config | Built-in, more complex config |

In your `proxy-learn/` project, we run both Caddy and Nginx so you can compare them side-by-side.

---

## 2. Real name

**Nginx** is an open-source web server software, also known as a reverse proxy load balancer, HTTP cache, and web server for Unix systems. It's known for high performance, stability, and low resource consumption.

**Key Nginx concepts**:

| Concept | Description |
|---------|-------------|
| **Server block** | Nginx's equivalent of Caddy's server block. Defines how a domain/protocol is handled. |
| **location block** | Matches a URL path or pattern within a server block. Like Caddy's `handle` blocks. |
| **proxy_pass** | Forwards requests to a backend server. Nginx's equivalent of Caddy's `reverse_proxy`. |
| **upstream** | Defines a group of backend servers for load balancing. |
| **certbot** | The standard tool for getting Let's Encrypt certificates and configuring Nginx. |
| **server_name** | The domain name that this server block responds to. Like Caddy's domain listing. |
| **sendfile** | High-performance file transfer method (zero-copy between file and network). |
| **keepalive** | Number of keepalive connections to keep open to backends. |

**Typical Nginx architecture**:

```
+----------------------+
|   Browser / curl    |
+----------+-----------+
           |
           v
+----------------------+       +--------------+
|      Nginx           | <-->   |  Node.js app |
|  (reverse proxy)     |       |  (backend)   |
+----------------------+       +--------------+
         HTTP                   port 3000
           |
           v
+----------------------+
|  Static files, SSL   |
+----------------------+
```

---

## 3. Config example

### Your Nginx config (from proxy-learn/)

```nginx
# nginx.conf - reverse proxy for proxy-learn (HTTP only, no SSL)
# Maps app1.localhost and app2.localhost to the Node.js app
# For comparison with Caddy's automatic HTTPS

events {
    worker_connections 1024;
}
http {
    # Disable server tokens for security
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # MIME types
    include /etc/nginx/mime.types;
    
    # Default type
    default_type application/octet-stream;
    
    # Log format
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Server block for app1.localhost (HTTP)
    server {
        listen 80;
        server_name app1.localhost;
        
        # Reverse proxy to the Node.js app
        location / {
            proxy_pass http://app:3000;
            
            # Forwarded headers - crucial for the backend to see real client info
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Security headers
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-origin-only" always;
    }
    
    # Server block for app2.localhost (HTTP)
    server {
        listen 80;
        server_name app2.localhost;
        
        # Reverse proxy to the Node.js app
        location / {
            proxy_pass http://app:3000;
            
            # Forwarded headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Custom header for tenant identification
        add_header X-Tenant-Id "app2" always;
        
        # Security headers
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-origin-only" always;
    }
}
```

### Nginx with SSL/TLS (using certbot - for real Let's Encrypt certs):

```nginx
# After running: sudo certbot --nginx -d app1.localhost
# certbot automatically modifies this config

server {
    listen 443 ssl;
    server_name app1.localhost;
    
    # Certbot automatically inserts these paths
    ssl_certificate /etc/letsencrypt/live/app1.localhost/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app1.localhost/privkey.pem;
    
    # SSL configuration (TLS versions and ciphers)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Optional: HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Reverse proxy
    location / {
        proxy_pass http://app:3000;
        
        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-origin-only" always;
}
```

### Nginx with load balancing (upstream block):

```nginx
# Define backend servers
upstream app_backend {
    # Round-robin across these servers
    server app-a:3000;
    server app-b:3000;
    server app-c:3000;
}

server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        # Pass requests to the upstream group
        proxy_pass http://app_backend;
        
        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Nginx with custom error pages:

```nginx
server {
    listen 80;
    server_name app1.localhost;
    
    location / {
        proxy_pass http://app:3000;
    }
    
    # Custom error pages
    error_page 404 /custom_404.html;
    error_page 502 /custom_502.html;
    
    location = /custom_404.html {
        root /usr/share/nginx/html;
        internal;
    }
    
    location = /custom_502.html {
        root /usr/share/nginx/html;
        internal;
    }
}
```

---

## 4. Commands and what you should see

### Check Nginx status

```bash
# Check nginx container status
docker compose ps 2>&1 | grep nginx

; Expected: proxy-learn-nginx should be "Up" status (it's running in proxy-learn)
```

### Test Nginx reverse proxy (HTTP)

```bash
# Test through Nginx on port 8080
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

### Test Nginx with SSL (if using certbot-installed certs - conceptual)

```bash
# This would test HTTPS through Nginx with real certs
; Not typically tested in proxy-learn (we use Caddy for HTTPS)
; But would look like:
curl -v https://app1.localhost/

; Expected: HTTPS working, cert from Let's Encrypt (if certbot was used)
```

### Check Nginx error logs

```bash
# View any Nginx errors
docker compose logs nginx 2>&1 | tail -10

; Expected: Should show "ready for start up" or any configuration errors
; In proxy-learn, since we're HTTP only, should show no SSL-related errors
```

### Test Nginx configuration syntax

```bash
# Test Nginx config syntax (if running Nginx directly, not in docker)
; In Docker, this is handled by the entrypoint
; But you can check the config file:
nginx -t -c /etc/nginx/nginx.conf 2>&1

; Expected: "the configuration file /etc/nginx/nginx.conf syntax is ok"
; And: "is successful"
```

### Check Nginx worker processes

```bash
# View Nginx's current worker configuration
docker compose exec nginx cat /etc/nginx/nginx.conf | grep -E "worker|keepalive"

; Expected: Shows the configuration directives
```

### Compare Caddy vs Nginx output

```bash
# Both should serve the app, but with different headers/behavior

# Caddy (HTTPS, port 443)
curl -k https://app1.localhost/ | head -5

; Expected: Shows Caddy-served content, TLS info

# Nginx (HTTP, port 8080)
curl http://localhost:8080/ | head -5

; Expected: Shows Nginx-served content, no TLS
```

### Nginx version check

```bash
# Check Nginx version
nginx -v 2>&1

; Expected: nginx/1.26.0 (Ubuntu) or similar version display
```

### Test proxy headers with Nginx

```bash
# Verify the backend sees forwarded headers
curl -k https://app1.localhost/headers 2>&1 | grep -E "Host|X-Forwarded"

; Expected: Shows app's perspective on what headers were forwarded
; With Nginx: X-Forwarded-For and X-Forwarded-Proto may or may not be set
; Depending on config (we set them in the config above)
```

---

## 5. In a real multi-tenant SaaS

### Nginx for SaaS custom domains:

```nginx
# Nginx server block for a tenant's custom domain
server {
    listen 80;
    server_name store-a.example.com;
    
    # Reverse proxy to tenant's app instance
    location / {
        proxy_pass http://app-a:3000;
        
        # Forwarded headers for tenant awareness
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-origin-only" always;
}
```

### Nginx with certbot for Let's Encrypt:

```bash
# Get a certificate for a tenant domain
sudo certbot --nginx -d store-a.example.com

# certbot will automatically:
# 1. Start a temporary web server for HTTP-01 challenge
# 2. Verify domain ownership
# 3. Install the certificate
# 4. Modify this Nginx config to use the cert
# 5. Set up auto-renewal via cron

# Resulting config (auto-generated by certbot):
server {
    listen 443 ssl;
    server_name store-a.example.com;
    
    ssl_certificate /etc/letsencrypt/live/store-a.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store-a.example.com/privkey.pem;
    
    # ... rest of config
}
```

### Nginx with multiple tenants:

```nginx
# Multiple tenant server blocks
server {
    listen 80;
    server_name store-a.example.com;
    # ... tenant A config
}

server {
    listen 80;
    server_name store-b.example.com;
    # ... tenant B config
}

server {
    listen 80;
    server_name store-c.example.com;
    # ... tenant C config
}
```

### Nginx vs Caddy for SaaS (comparison):

| Scenario | Better choice | Why |
|----------|--------------|-----|
| **SaaS with custom domains** | Caddy | Automatic HTTPS, easier config, On-Demand TLS |
| **High-performance static serving** | Nginx | More mature static file handling |
| **Complex load balancing** | Nginx | More granular control over weighted distribution |
| **SaaS with few tenants (1-5)** | Either | Both work, choice depends on existing infrastructure |
| **SaaS with many tenants (20+)** | Caddy | On-Demand TLS + simpler per-tenant config |
| **Already using Nginx elsewhere** | Nginx | Consistent infrastructure, don't introduce new tool |
| **Want automatic HTTPS with least config** | Caddy | "Just list domains, Caddy handles rest" |

### Nginx rate limiting for SaaS:

```nginx
# Rate limiting per tenant (or by IP)
limit_req_zone $binary_remote_addr zone=tenants:10 rate=10r/s;

server {
    listen 80;
    server_name store-a.example.com;
    
    # Apply rate limiting
    limit_req zone=tenants;
    
    location / {
        proxy_pass http://app-a:3000;
    }
}
```

### Nginx security headers for SaaS:

```nginx
# Security headers added to all tenant responses
server {
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-origin-only" always;
    add_header X-Tenant-Id "store-a" always;  # Tenant-specific header
}
```

### Nginx logging for SaaS observability:

```nginx
# Custom log format with tenant info
log_format tenant_log '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" $http_x_forwarded_for';

server {
    access_log /var/log/nginx/tenant-access.log tenant_log;
    
    location / {
        proxy_pass http://app-a:3000;
    }
}
```

---

## 6. When to use it and when NOT to

**Use Nginx knowledge when**:
- You need a high-performance web server or reverse proxy
- You're already using Nginx in your infrastructure
- You need fine-grained load balancing control
- You need to serve static files (images, CSS, JS) efficiently
- You need to use certbot for Let's Encrypt certificates
- You need upstream load balancing with advanced features

**NOT to choose Nginx if**:
- You want automatic HTTPS with zero config (Caddy is better)
- You prefer human-readable configuration (Caddyfile vs nginx.conf)
- You need On-Demand TLS for SaaS custom domains (Caddy feature)
- You're new to web servers and want the easiest learning curve (Caddy wins)
- You need built-in security headers by default (Caddy enables these automatically)

---

## 7. Common mistakes

- **Forgetting `proxy_set_header Host $host`**: The backend won't see the original `Host` header, which can cause routing issues and 400 Bad Request errors.
- **Forgetting `proxy_set_header X-Forwarded-Proto $scheme`**: The backend won't know if the original request was HTTP or HTTPS, which can cause redirect loops (HTTP→HTTPS→HTTP).
- **Using `localhost:3000` in Docker**: Inside a Docker container, `localhost` refers to the container itself, not the host machine. Always use Docker service names (like `app:3000`) or container IPs.
- **No SSL/TLS configuration when needed**: Running HTTPS without proper SSL certs and configuration will cause certificate errors or security warnings.
- **Confusing `location /` with `location @name`**: The `@` prefix defines named locations for internal redirects, not URI matching.
- **Not testing config syntax**: Always run `nginx -t` after modifying nginx.conf to catch syntax errors before reloading.
- **Too many worker processes**: More workers isn't always better. CPUs have limits, and too many workers can cause context switching overhead.
- **Ignoring the `root` directive**: If serving static files, you need a `root` or `alias` directive in your location block, otherwise Nginx returns 404 for everything.

---

## 8. Try it yourself

**Exercise**: Test Nginx configuration and compare with Caddy.

```bash
# 1. Verify Nginx is running
docker compose ps 2>&1 | grep nginx

; Expected: proxy-learn-nginx should be "Up" status

# 2. Test Nginx reverse proxy (HTTP through port 8080)
curl -k -s http://localhost:8080/ | head -5

; Expected: HTML from the app, served by Nginx

# 3. Test with verbose output to see headers
curl -v http://localhost:8080/ 2>&1 | grep -E "X-Frame|X-Content|Host"

; Expected: Security headers from Nginx config

# 4. Test the headers endpoint through Nginx
curl -v http://localhost:8080/headers 2>&1 | grep -E "Host|X-Forwarded"

; Expected: Shows the app's perspective on forwarded headers

# 5. Compare Caddy vs Nginx behavior
echo "=== Caddy (HTTPS) ==="
curl -k -s https://app1.localhost/ | head -3
echo ""
echo "=== Nginx (HTTP) ==="
curl -s http://localhost:8080/ | head -3

; Expected: Both serve the app, but Caddy adds TLS/HTTP-2, Nginx is plain HTTP

# 6. Check Nginx version
nginx -v 2>&1

; Expected: nginx/version number

# 7. Test Nginx config reload (if you modify the config)
; In proxy-learn, the config is mounted read-only, but conceptually:
; sudo nginx -t  # test syntax
; sudo systemctl reload nginx  # reload if syntax is ok

; Expected: "configuration file test is successful" and Nginx reloads
```

**Hint**: If Nginx shows `502 Bad Gateway`:
1. Check that the Node.js app container is running (`docker compose ps`)
2. Check that `proxy_pass http://app:3000;` can resolve the service name
3. Verify the Docker network is working (`docker network inspect proxy-learn_proxy-learn-network`)
4. Check Nginx error logs (`docker compose logs nginx`)

**Cleanup**: No cleanup needed - these commands only test the running proxy-learn setup.

---

## Next

[[09-forwarded-headers]] - Learn about Forwarded headers (`X-Forwarded-For`, `-Proto`, `-Host`), trusting proxies, and getting the real client IP.