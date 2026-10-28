# docs/06-caddy.md

## 1. Simple explanation (like I'm 7)

**Caddy** is a web server that's easy to use and automatically gets HTTPS certificates for you. It's like Nginx or Apache, but it "just works" with HTTPS.

### Why Caddy is special:

- **Automatic HTTPS**: You don't need to bother with certificate files. Caddy gets them automatically (via Let's Encrypt) and renews them before they expire.
- **Caddyfile**: The configuration is human-readable, not complex JSON or cryptic directives.
- **Secure by default**: Caddy enables HTTPS, security headers, and HTTPS redirection by default.
- **No config needed for HTTPS**: Just list your domain names, and Caddy handles the rest.

### Basic Caddy setup (what you have in proxy-learn):

```caddyfile
# This is your Caddyfile - human-readable config
app1.localhost {
  # Caddy automatically gets HTTPS for this domain
  # No `tls` line needed if you want Let's Encrypt
  
  # Instead, we use local certificates (chapter 5a):
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Forward requests to your Node.js app
  reverse_proxy app:3000
  
  # Add security headers
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
  }
}
```

---

## 2. Real name

**Caddy** is an open-source, enterprise-grade HTTP/2 and HTTPS web server written in Go. It's designed to be a drop-in replacement for Nginx or Apache, but with much simpler configuration and automatic HTTPS.

**Key Caddy concepts**:

| Concept | Description |
|---------|-------------|
| **Caddyfile** | The configuration file, written in simple syntax. No JSON, no complex blocks. |
| **Automatic HTTPS** | Caddy's killer feature. It automatically obtains and renews TLS certificates via Let's Encrypt. |
| **reverse_proxy** | forwards requests to backend servers (like your Node.js app). |
| **handle blocks** | conditional logic based on the request (like `if {host} match "..."`). |
| **admin API** | a built-in API at `localhost:2019` for viewing and changing config live. |
| **tls directive** | tells Caddy to get a certificate (via Let's Encrypt) or use provided cert files. |
| **header block** | adds HTTP response headers (security, caching, etc.). |
| **logging** | Caddy logs everything by default; you can customize format and destination. |

**Caddy's architecture**:

```
+----------------------+
|   Browser / curl    |
+----------+-----------+
           |
           v
+----------------------+       +--------------+
|      Caddy           | <-->   |  Node.js app |
|  (reverse proxy)     |       |  (backend)   |
+----------------------+       +--------------+
         HTTPS                 port 3000
           |
           v
+----------------------+
|   TLS/HTTPS handling |
+----------------------+
```

---

## 3. Config example

### Your current Caddyfile (from proxy-learn/)

```caddyfile
# Caddyfile for proxy-learn local development
# Uses local certificates signed by a local CA
# Subdomains app1.localhost and app2.localhost resolve to localhost via /etc/hosts

app1.localhost {
  # Use local certificates instead of Let's Encrypt
  # Certificate and key provided separately
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Reverse proxy to the Node.js app via Docker network service discovery
  reverse_proxy app:3000
  
  # Security headers
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-origin-only"
  }
}

app2.localhost {
  # Use local certificates instead of Let's Encrypt
  # Certificate and key provided separately
  tls /etc/caddy/certs/server-cert.pem /etc/caddy/certs/server-key.pem
  
  # Reverse proxy to the Node.js app
  reverse_proxy app:3000
  
  # Custom headers for tenant identification
  header {
    X-Tenant-Id "{uri}"
  }
  
  # Security headers
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-origin-only"
  }
}
```

### Caddyfile with Let's Encrypt automatic HTTPS (staging):

```caddyfile
# This would use Let's Encrypt instead of local certs
# Uncomment and the `tls` line is not needed - Caddy handles everything

# app1.localhost {
#   # Caddy automatically gets a Let's Encrypt certificate
#   # Handles HTTP-01 challenge automatically
#   reverse_proxy app:3000
# }
```

### Caddyfile with `handle` blocks (tenant routing):

```caddyfile
# Route based on the Host header (for multi-tenant SaaS)
*.example.com {
  # On first request, Caddy can issue a certificate (On-Demand TLS - chapter 8)
  tls {
    # If using DNS-01 challenge:
    dns challenge-provider digitalocean
    
    # Or HTTP-01:
    # http_response coded 404  # fallback
  }
  
  # Route based on the Host header
  handle {
    route {
      # If Host is store-a.example.com
      if {host} * "store-a.example.com" {
        reverse_proxy app-a:3000
      }
      
      # If Host is store-b.example.com
      if {host} * "store-b.example.com" {
        reverse_proxy app-b:3000
      }
      
      # Default: 404 or redirect
      response 404 "No tenant found for this domain"
    }
  }
  
  # Security headers
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
```

### Caddyfile with load balancing (multiple backend instances):

```caddyfile
# Distribute requests across multiple app instances
app1.localhost {
  # Round-robin across all listed backends
  reverse_proxy app-a:3000 app-b:3000 app-c:3000
  
  # Or weighted distribution
  # reverse_proxy app-a:3000 0.5  # 50% of traffic
  # reverse_proxy app-b:3000 0.3  # 30% of traffic
  # reverse_proxy app-c:3000 0.2  # 20% of traffic
}
```

### Caddyfile with HTTP->HTTPS redirect:

```caddyfile
# Redirect all HTTP traffic to HTTPS
# This is typically on port 80

localhost:80 {
  # Redirect everything to HTTPS
  redir https://{host}{uri} 301
  
  # Or specifically for a subdomain
  # redir https://{host}{uri} 301 if {scheme} == http
}
```

### Caddyfile with custom error pages:

```caddyfile
app1.localhost {
  # Custom 404 page
  errors {
    file 404 /404.html
  }
  
  # Custom 502 page
  errors {
    file 502 /502.html
  }
  
  reverse_proxy app:3000
}
```

---

## 4. Commands and what you should see

### Start Caddy and check it's running

```bash
# Check Caddy status (already running in proxy-learn)
docker compose ps 2>&1 | grep caddy

; Expected:
; proxy-learn-caddy   caddy:latest      "caddy run --config …"   caddy     Up XX seconds   0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp, 443/udp, 2019/tcp
```

### Test Caddy HTTPS (already verified earlier)

```bash
# Test HTTPS through Caddy
curl -k https://app1.localhost/

; Expected output (relevant parts):
<HTML>
<H1>Hello from the Node.js app!</H1>
<P>Host header: app1.localhost</P>
```

```bash
# Verbose test to see Caddy headers
curl -v -k https://app1.localhost/ 2>&1 | head -20

; Expected:
* SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 / ...
< Server: Caddy
< X-Content-Type-Options: nosniff
< X-Frame-Options: DENY
< ...
```

### Test Caddy admin API

```bash
# View Caddy's current configuration (JSON format)
curl http://localhost:2019/config 2>&1 | python3 -m json.tool | head -30

; Expected: Shows the parsed Caddyfile config as JSON
; Port 2019 is Caddy's admin API (default, localhost-only)
```

```bash
# Reload Caddy config (using the admin API)
curl -X PUT -d @Caddyfile http://localhost:2019/load 2>&1

; Expected: "Configuration loaded successfully" or similar confirmation
```

```bash
# Check Caddy logs
docker compose logs caddy 2>&1 | tail -10

; Expected: Shows Caddy starting, config adaptation, server running messages
```

### Check Caddy version and build info

```bash
# From inside the container or using the binary
caddy version

; Expected:
; 2.7.6 h2finfo=0
; See version display for full details
```

### Test that Host header is forwarded

```bash
# The app should see the correct Host header
curl -k https://app1.localhost/headers

; Expected:
<p>Host header: app1.localhost</p>
<p>X-Forwarded-For: 172.23.0.1</p>
```

### Test redirect from HTTP to HTTPS

```bash
# This should redirect (Caddy auto-redirects HTTP to HTTPS when using automatic HTTPS)
curl -v http://app1.localhost/ 2>&1 | head -15

; Expected: 
< HTTP/1.1 308 Permanent Redirect
< Location: https://app1.localhost/
```

### Test Caddyfmt (config formatting)

```bash
# Format the Caddyfile (Caddy can do this itself)
caddy fmt --overwrite Caddyfile

; Expected: "Running caddy fmt on Caddyfile"
; Makes your Caddyfile consistent with Caddy's formatting rules
```

### Key Caddyfile syntax to understand:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `domain { }` | Server block for the domain | `app1.localhost { }` |
| `tls cert key` | Provide certificate files | `tls /path/cert.pem /path/key.pem` |
| `reverse_proxy up:port` | Forward to backend | `reverse_proxy app:3000` |
| `header { }` | Add response headers | `header { X-Frame-Options "DENY" }` |
| `handle { }` | Conditional logic | `handle { if {host} * "store.com" { ... } }` |
| `redir url code` | Redirect requests | `redir https://{host}{uri} 301` |
| `errors { }` | Custom error pages | `errors { file 404 /404.html }` |

---

## 5. In a real multi-tenant SaaS

### Caddy as the central reverse proxy for SaaS:

```caddyfile
# Central Caddy configuration for a SaaS platform

# Wildcard domain covers all tenant subdomains
*.example.com {
  # Caddy will automatically get a wildcard certificate (DNS-01 challenge)
  # Or use a pre-provisioned wildcard cert
  
  # On first request, issue a certificate (On-Demand TLS - chapter 8)
  tls {
    dns challenge-provider route53  # or your DNS provider
  }
  
  # Route based on the specific subdomain (the Host header)
  handle {
    route {
      # Tenant A
      if {host} * "store-a.example.com" {
        reverse_proxy app-a:3000
        header {
          X-Tenant-Id "store-a"
        }
      }
      
      # Tenant B  
      if {host} * "store-b.example.com" {
        reverse_proxy app-b:3000
        header {
          X-Tenant-Id "store-b"
        }
      }
      
      # Tenant C
      if {host} * "store-c.example.com" {
        reverse_proxy app-c:3000
        header {
          X-Tenant-Id "store-c"
        }
      }
      
      # Fallback if no tenant matches
      response 404 "Tenant not found"
    }
  }
  
  # HSTS - force HTTPS for all subdomains
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
```

### Caddy automatic HTTPS per tenant:

```caddyfile
# Each tenant gets automatic HTTPS with no config changes
# Caddy handles certificate issuance and renewal automatically

store-a.example.com {
  # No `tls` directive needed - Caddy gets Let's Encrypt cert automatically
  reverse_proxy app-a:3000
}

store-b.example.com {
  # Caddy automatically gets a separate cert for this domain
  reverse_proxy app-b:3000
}

store-c.example.com {
  # Same - automatic HTTPS
  reverse_proxy app-c:3000
}
```

### Caddy On-Demand TLS (chapter 8 - critical for SaaS):

```caddyfile
# On-Demand TLS: certificate issued only on first request
# The `ask` endpoint must verify the domain belongs to a real tenant

store-a.example.com {
  # Caddy will call the `ask` endpoint before issuing a certificate
  # If the endpoint returns 4xx, no cert is issued (and request fails)
  # If the endpoint returns 2xx, cert is issued and request proceeds
  tls {
    ask http://your-tenant-verification-service/verify  # must return 2xx
  }
  
  reverse_proxy app-a:3000
  
  # Important: The ask endpoint must be rate-limited and secure!
  # If it's not, attackers can:
  #   - Exhaust rate limits
  #   - Get certificates for domains they don't own
  #   - Cause abuse and service denial
}
```

### Caddy load balancing for tenant apps:

```caddyfile
# High availability: multiple app instances per tenant
store-a.example.com {
  # Round-robin across 3 app servers
  reverse_proxy app-a-1:3000 app-a-2:3000 app-a-3:3000
  
  # Health checking - Caddy will automatically remove unhealthy backends
  # If app-a-1:3000 stops responding, traffic goes to app-a-2 and app-a-3
  
  # Or weighted distribution
  # reverse_proxy app-a-1:3000 0.5
  # reverse_proxy app-a-2:3000 0.3
  # reverse_proxy app-a-3:3000 0.2
}
```

### Caddy header manipulation for SaaS:

```caddyfile
# Add tenant-identifying headers for the backend
store-a.example.com {
  # The backend can see which tenant is making the request
  header {
    X-Tenant-Id "{host}"       # The Host header value
    X-Forwarded-Proto "{scheme}"  # http or https
    X-Real-IP "{remote}"          # Client's real IP
  }
  
  reverse_proxy app-a:3000
}
```

### Caddy logging for SaaS observability:

```caddyfile
# Custom logging format for tenant tracking
app1.localhost {
  # Log to a file with tenant info
  log {
    output /var/log/caddy/tenant.log
    format single_line {indent 0} {host} {method} {uri} {status} {resp_bytes} {time}
  }
  
  # Or log to stdout with JSON format (easier for log aggregation)
  log {
    output stdout
    format json
  }
  
  reverse_proxy app:3000
}
```

### Caddyfile versioning and auto-save:

```caddyfile
# Caddy automatically autosaves your config
# Every change is saved to /config/caddy/autosave.json
# You can resume with: caddy run --resume

# The admin API respects this:
curl http://localhost:2019/changes  # shows pending changes
curl -X PUT -d @autosave.json http://localhost:2019/load  # load saved changes
```

---

## 6. When to use it and when NOT to

**Use Caddy knowledge when**:
- Setting up reverse proxy for your applications
- You want automatic HTTPS with Let's Encrypt
- You prefer human-readable config (Caddyfile) over JSON
- You need tenant routing via Host header
- You need On-Demand TLS for SaaS custom domains
- You want built-in security headers and HSTS
- You need an admin API for live config changes

**NOT to use Caddy if**:
- You need complex WebSocket session affinity that Caddy's basic `reverse_proxy` doesn't support (use `websocket` directive instead)
- You're already deeply invested in Nginx config management and want to keep it
- You need Apache `.htaccess`-style rewrites (Caddy uses its own rewrite syntax)
- You need extremely fine-grained access control lists (ACLs) at the proxy level
- You require WebDAV support (Caddy removed it, focusing on modern web use cases)

---

## 7. Common mistakes

- **Forgetting the trailing dot in Caddyfile**: Some domain comparisons need the dot, some don't. Be consistent.
- **Using `reverse_proxy` without forwarded headers**: The backend won't see the real `Host`, `X-Forwarded-For`, or `X-Forwarded-Proto`. Always add `header` block or `proxy_set_header` equivalents.
- **Mixing HTTP and HTTPS in one Caddyfile**: Either use `http:` prefix for HTTP-only servers, or rely on Caddy's automatic HTTPS for all listed domains.
- **Not handling the `ask` endpoint risks**: In On-Demand TLS, if the `ask` endpoint is down or rate-limited, all your tenants' HTTPS will break. Have a fallback or pre-provisioned certs.
- **Using `*` in `reverse_proxy` indiscriminately**: `reverse_proxy *` matches any path, but combined with `handle` blocks, be explicit about what you're matching.
- **Forgetting Caddy needs port 80 for HTTP-01 challenges**: If you want Let's Encrypt automatic HTTPS, make sure port 80 is open and reachable from the internet.
- **Using deprecated `tls` syntax**: Caddy v2 uses `tls` directive, not the old `log` or `ssl` syntax from v1.
- **Ignoring Caddy's automatic redirect from HTTP to HTTPS**: If you have a `localhost:80` block without a redirect, HTTP requests won't be redirected. Add `redir https://{host}{uri}`.

---

## 8. Try it yourself

**Exercise**: Test Caddy configuration and observe its behavior.

```bash
# 1. Verify Caddy is running with our config
docker compose ps 2>&1 | grep caddy

; Expected: proxy-learn-caddy should be "Up" status

# 2. Test HTTPS through Caddy
curl -k -s https://app1.localhost/

; Expected: HTML from the app, showing "Host header: app1.localhost"

# 3. Test verbose output to see Caddy headers
curl -v -k https://app1.localhost/ 2>&1 | grep -E "Server:|X-Content|X-Frame|X- Tenant"

; Expected: Caddy security headers (X-Content-Type-Options, X-Frame-Options)

# 4. Check the Caddy admin API
curl http://localhost:2019/config 2>&1 | python3 -c "import sys,json; data=json.load(sys.stdin); print('Server:', data.get('appserver', {}).get('name', 'N/A'))"

; Expected: Shows Caddy is running and configured

# 5. Test HTTP->HTTPS redirect
curl -v http://app1.localhost/ 2>&1 | head -10

; Expected: 308 Permanent Redirect, Location: https://app1.localhost/

# 6. Test the headers endpoint to see forwarded headers
curl -k https://app1.localhost/headers

; Expected: Shows Host header from the app's perspective
```

**Hint**: If you get connection refused on port 2019:
1. Make sure the Caddy container is running (`docker compose ps`)
2. Port 2019 is only bound to localhost by default in Caddy's config
3. You might need to add `admin API` config if it's not running

**Cleanup**: No cleanup needed - these commands only test the running proxy-learn setup.

---

## Next

[[07-caddy-ondemand-tls]] - Learn about Caddy On-Demand TLS: how it issues certificates on the first request, the `ask` endpoint that must verify the domain belongs to a real tenant (and the abuse and rate-limit risks if it does not).