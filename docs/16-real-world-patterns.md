# docs/16-real-world-patterns.md

## 1. Simple explanation (like I'm 7)

**Real-world patterns** are the complete, practical ways everything you've learned fits together to run a real SaaS platform. It's one thing to learn each piece separately, but putting it all together is how you actually build something people use.

### The full custom-domain flow (local setup):

```text
# Step-by-step: New merchant onboards with custom domain

1. Merchant signs up and enters: store.example.com
2. SaaS shows DNS instructions:
   "Add CNAME record: store → your-proxy-domain"
3. Merchant adds CNAME at their domain registrar
4. SaaS verifies domain resolves (using `dig store.example.com`)
5. SaaS waits for DNS propagation (TTL dependent, typically 5 min to 24 hours)
6. Caddy/Let's Encrypt issues HTTPS certificate for store.example.com
7. Requests to https://store.example.com arrive at the proxy
8. Proxy reads the Host: store.example.com header
9. App looks up which merchant owns store.example.com
10. App serves the correct tenant's content
11. HTTPS lock shows in browser, tenant's dashboard loads
```

### Next.js app behind Caddy:

```text
# Running a Next.js application behind Caddy:

; Next.js characteristics:
; - Runs on port 3000 (SSR, API routes, static generation)
; - Needs HTTPS for production (next.config.js with https)
; - May use WebSockets for real-time features
; - Serves both static files and API endpoints

; Caddy configuration for Next.js:

; Caddyfile:
nextjs-store.example.com {
  # HTTPS via Let's Encrypt (automatic) or local certs
  tls /etc/caddy/certs/nextjs-cert.pem /etc/caddy/certs/nextjs-key.pem
  
  # Reverse proxy to Next.js app
  reverse_proxy app:3000
  
  # Handle WebSockets if Next.js uses them
  # Caddy's reverse_proxy handles WS upgrades automatically
  
  # Compress Next.js responses (automatic with Caddy's brotli/gzip)
  
  # Cache control for static assets
  header {
    Cache-Control "public, max-age=3600"  # 1 hour for generated assets
  }
}
```

### Zero-downtime config reload:

```text
# How to reload Caddy config without downtime for your SaaS:

# Phase 1: Prepare the new config
; 1. Modify Caddyfile or Caddy JSON config
; 2. Test syntax: caddy fmt --check Caddyfile && caddy validate --config Caddyfile
; 3. Save current config as backup: cp config Caddyfile config.backup

; Phase 2: Reload Caddy (smooth, no downtime)
; Option A: Using admin API (recommended)
;   curl -X POST http://localhost:2019/load  # Load autosaved config
;   Or: curl -X PUT -d @Caddyfile http://localhost:2019/load

; Option B: Using signal (Caddy handles gracefully)
;   kill -SIGHUP $(docker compose ps -q caddy)
;   Caddy autosaves and reloads on next request

; Option C: Using docker compose
;   docker compose up -d caddy  # Redeploys with new config

; Phase 3: Verify the reload
;   1. Test the new config works: curl -k https://domain/
;   2. Check Caddy logs: docker compose logs caddy | grep -i "config\|reload"
;   3. Monitor for errors over 5-10 minutes
;   4. If issues: revert from config.backup

; Why it's zero-downtime:
; - Caddy autosaves before making changes
; - Existing connections finish before shutting down
; - New connections use the new config
; - No "502 Bad Gateway" during the transition
; - DNS remains pointing to the same IP throughout

; Best practices for SaaS:
; - Schedule reloads during low-traffic periods (early morning)
; - Always test in staging first (your proxy-learn setup!)
; - Have rollback plan (restore config.backup if needed)
; - Monitor error rates after reload for at least 15 minutes
```

### Pitfalls of each configuration:

```text
# Common pitfalls and how to avoid them:

; Caddy automatic HTTPS
; Pitfalls:
;   - CAA records blocking Let's Encrypt (check with dig domain CAA +short)
;   - Port 80 blocked by firewall (HTTP-01 challenge can't run)
;   - Rate limits exceeded (5 new certs/domain/week in production)
;   - DNS propagation not waited on (TTL dependent)
;   - Testing in production directly (always use --staging first!)
;   - Forgetting HSTS after enabling HTTPS (browser cache issues)

; Nginx + certbot
; Pitfalls:
;   - certbot modifies nginx.conf (always backup first!)
;   - Manual reload required after each cert issuance/renewal
;   - Forgetting to test renewals (certs expire in 90 days)
;   - Not updating certbot config when infrastructure changes
;   - Conflicting with existing Nginx server blocks

; On-Demand TLS (`ask` endpoint)
; Pitfalls:
;   - `ask` endpoint returns wrong status codes (2xx vs 4xx vs 429)
;   - Rate limiting not implemented → exhaust Let's Encrypt limits quickly
;   - Testing in production directly (always use staging first!)
;   - Domain validation insufficient → attackers get certs for unauthorized domains
;   - Delay on first HTTPS request (2-10 seconds, user experience impact)
;   - Not cleaning up certs when tenants leave (wastes rate limit budget)

; Wildcard certificates
; Pitfalls:
;   - DNS-01 challenge complex (need DNS provider API credentials)
;   - Harder to revoke individual tenant access (one cert covers all)
;   - If one subdomain gets compromised, all subdomains affected
;   - DNS provider API in config could be exposed if repo is public
;   - Browser warnings if not properly deployed (some older clients)

; Docker networking
; Pitfalls:
;   - Using `localhost:3000` inside Docker containers (localhost = container, not host!)
;   - Must use Docker service names: `app:3000` not `localhost:3000`
;   - Port 3000 must NOT be exposed to host (only 80/443 should be)
;   - Docker network DNS resolution within compose file works via service names
;   - `extra_hosts` in compose for /etc/hosts entries within containers

; Host header handling
; Pitfalls:
;   - Forgetting `proxy_set_header Host $host` in Nginx (backend sees wrong Host)
;   - Caddy automatic but still verify backend receives correct Host
;   - Not validating Host header in SaaS app (security: possible header injection)
;   - Mixing Caddy and Nginx configs causing Host header conflicts
;   - Assuming all requests have Host header (HTTP/1.1 requires it, but still)

; Cloudflare integration
; Pitfalls:
;   - Using "Flexible" SSL mode (dangerous! never use in production!)
;   - Not updating nameservers when adding domain to Cloudflare dashboard
;   - Proxied mode without HTTPS on origin (Full mode won't work)
;   - Page Rules conflicting with app-level redirects
;   - Cache TTL too long for frequently changed SaaS content
;   - WebSocket connections interfered by Cloudflare caching/or optimization

; Firewall/ports
; Pitfalls:
;   - Exposing port 3000 to internet (security risk, never do this!)
;   - Not allowing ports 80/443 (users can't reach your site)
;   - Forgetting Docker network isolation (containers should communicate via network)
;   - Running Caddy/Nginx as root user (run as non-root for security)

; Security headers
; Pitfalls:
;   - Forgetting HSTS after enabling HTTPS (browser won't allow HTTP ever again)
;   - Inconsistent www ↔ non-www handling (create redirect rules, not both ways)
;   - Missing X-Content-Type-Options (enables MIME-type sniffing attacks)
;   - CSP (Content-Security-Policy) too restrictive, breaking site functionality
;   - Forgetting to update HSTS when changing domains (browser cache purge needed)
```

---

## 2. Real-world patterns - Full Custom Domain Flow (Local Setup)

### The complete flow from merchant signup to live HTTPS:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    MERCHANT ONBOARDING FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐   ┌────────────────────┐   ┌──────────────┐ │
│  │  New Merchant   │   │  SaaS Dashboard    │   │  DNS         │ │
│  │  Signup         │──►│  Shows DNS         │──►│  Instructions│ │
│  │  (store.com)    │   │  CNAME: store →    │   │  (CNAME to   │ │
│  └─────────────────┘   │  your-proxy.com)     │   │  proxy)      │ │
│                          └────────────────────┘   └──────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  1. Merchant adds CNAME at domain registrar:                │ │
│  │     store.com CNAME → your-proxy.com                      │ │
│  │  2. SaaS verifies: dig store.com                         │ │
│  │  3. Wait for DNS propagation (TTL dependent)              │ │
│  │  4. Caddy/Let's Encrypt issues HTTPS cert                 │ │
│  │  5. HTTPS activates for store.com                       │ │
│  │  6. App routes by Host: store.com → Tenant 1 content      │ │
│  │  7. Browser shows HTTPS lock, dashboard loads             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-step with actual proxy-learn commands:

```text
# Step 1: Add merchant domain to /etc/hosts (simulating DNS entry)
; echo "127.0.0.1 store.example.com" >> /etc/hosts

# Step 2: Verify DNS resolution (immediate with /etc/hosts)
; dig store.example.com +short
; 127.0.0.1

# Step 3: Test HTTPS through the proxy
; curl -k https://store.example.com/
; <h1>Hello from the Node.js app!</h1>
; <p>Host header: store.example.com</p>

; (In real setup with real domains + Let's Encrypt, cert would be auto-issued)

# Step 4: App resolves tenant from Host header
; The Node.js app sees Host: store.example.com
; Looks up tenants['store.example.com']
; Returns the correct tenant's content

# Step 5: Full cycle verified
; - DNS resolves
; - HTTPS works
; - Tenant content served correctly
; - Browser shows padlock icon
```

### Next.js app behind Caddy - detailed config:

```text
# When running Next.js (popular React framework) behind Caddy:

; Next.js needs:
; - HTTPS in production (next.config.js server: { https: true })
; - Static assets served efficiently
; - API routes (e.g., /api/health) working over HTTPS
; - WebSocket support if using real-time features

; Caddyfile for Next.js:

; nextjs-store.example.com {
;   # HTTPS - Caddy gets Let's Encrypt auto, or use local certs
;   tls /etc/caddy/certs/nextjs-cert.pem /etc/caddy/certs/nextjs-key.pem
  
;   # Reverse proxy to Next.js (port 3000 default)
;   reverse_proxy app:3000
  
;   # Compress responses (automatic with Caddy - brotli/gzip)
;   # Caddy detects JS/CSS/HTML and compresses appropriately
  
;   # Cache static assets (JS, CSS, images)
;   # Header sent to browser for caching
;   header {
;     Cache-Control "public, max-age=31536000, immutable"
;     # 1 year caching for generated assets
;   }
; }
```

### Zero-downtime config reload - detailed pattern:

```text
# Production zero-downtime Caddy reload pattern:

# 1. PREPARE (off-peak hours)
;   - Modify Caddyfile in staging first
;   - Test with: caddy fmt --check Caddyfile && caddy validate --config Caddyfile
;   - Backup current config: cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup
;   - Notify team: "Deploying config change at 2am"

; 2. RELOAD (smooth transition)
; Option A - Admin API (recommended, cleanest):
;   curl -X PUT -d @Caddyfile http://localhost:2019/load
;   - Caddy autosaves, then loads new config
;   - New config takes effect on next request
;   - Existing connections finish naturally

; Option B - SIGHUP signal:
;   kill -SIGHUP $(docker compose ps -q caddy)
;   - Caddy receives signal, autosaves, reloads
;   - Graceful, no forced connection termination

; Option C - Docker compose redeploy:
;   docker compose up -d caddy
;   - Redeploys container with new volume-mounted config
;   - Slightly longer than API/signal method

; 3. VERIFY (monitor for 10-15 minutes)
;   - curl -k https://domain/  (test new config works)
;   - docker compose logs caddy | grep -i "error\|reload" (check for issues)
;   - Monitor error rates over 15 minutes
;   - If issues: cp /etc/caddy/Caddyfile.backup /etc/caddy/Caddyfile && reload

; 4. CLEANUP
;   - Remove backup if everything ok
;   - Document what changed in deployment log
;   - Update runbooks with new configuration

; Key to zero-downtime:
; - Caddy autosaves config before making changes
; - No forced connection termination (connections drain naturally)
; - DNS remains pointing to same IP throughout (no IP changes)
; - Test in staging (your proxy-learn!) before production
```

### Pitfalls summary table:

| Configuration | Pitfall | Prevention |
|--------------|---------|------------|
| **Caddy auto-HTTPS** | CAA blocks Let's Encrypt | Check CAA before relying on auto-HTTPS |
| | Port 80 blocked | Ensure port 80 accessible from internet for HTTP-01 |
| | Rate limits | Use staging first; renewals are unlimited |
| | DNS propagation | Wait on TTL, or lower TTL before changes |
| | Production testing | Always use `--staging` first |
| | Forgetting HSTS | HSTS auto-added by Caddy, verify it's there |
| **Nginx + certbot** | certbot modifies nginx.conf | Backup nginx.conf before certbot runs |
| | Manual reload needed | Set up auto-renewal cron (certbot handles this) |
| | Forgetting to test renewals | Calendar reminder 7 days before expiry |
| | Conflicting server blocks | Review full config after certbot |
| **On-Demand TLS** | `ask` endpoint bugs | Test extensively in staging; return 2xx/4xx/429 correctly |
| | No rate limiting on `ask` | Implement rate limiting (10-20 req/min per IP) |
| | Production testing first | Always test in `--staging` environment first |
| | Domain validation weak | Strict validation in `ask` endpoint - verify domain ownership |
| | First-request delay | Expect 2-10s delay; show loading state to users |
| | Not cleaning up certs | Revoke certs when tenants leave; free rate limit budget |
| **Wildcard certs** | DNS-01 complex setup | Use Caddy DNS provider plugins; automate deployment |
| | Harder to revoke per-tenant | Consider per-tenant certs for multi-tenant SaaS security |
| | Subdomain compromise | If one `*.example.com` subdomain compromised, rotate all certs |
| | DNS provider API exposure | Keep API credentials in secret management, not repo |
| **Docker networking** | `localhost:3000` inside container | Use `app:3000` (Docker service name) not `localhost:3000` |
| | Port 3000 exposed to internet | Only expose 80/443; keep 3000 internal only |
| | Service name resolution fails | Ensure Docker compose network is healthy; `docker network inspect` |
| | `extra_hosts` not propagating | Verify container can reach /etc/hosts entries |
| **Host header** | Forgetting Nginx `proxy_set_header Host $host` | Add it - backend sees correct domain |
; | Caddy automatic but verify | Check backend logs to confirm Host header received |
; | Not validating in SaaS app | Implement Host header validation (security risk if not) |
; | Caddy/Nginx conflicts | Pick one, don't run both for same domains without purpose |
| **Cloudflare** | Using "Flexible" SSL | NEVER use "Flexible" - always "Full" or "Full (strict)" |
| | Not updating nameservers | Update domain's NS records to point to Cloudflare |
; | Proxied mode without origin HTTPS | Get Let's Encrypt cert first, then add Cloudflare |
; | Page Rules conflicts | Test Page Rules in staging; ensure they don't conflict with app |
; | Cache TTL too long | Use shorter TTL (5 min - 2 hours) for dynamic SaaS content |
| **Firewall/ports** | Exposing port 3000 | Only expose 80/443; keep app ports internal |
; | Not allowing 80/443 | These are necessary ports - must be accessible |
; | Forgetting Docker network isolation | Use Docker bridge network; verify with `docker network inspect` |
; | Running as root | Run Caddy/Nginx/app as non-root users |
| **Security headers** | Forgetting HSTS after HTTPS | Caddy adds it automatically; verify with `curl -I` |
; | Inconsistent www/non-www | Set up one redirect (www→non-www OR reverse, not both) |
; | Missing X-Content-Type-Options | Add Caddy header block or Nginx add_header |
; | CSP too restrictive | Start permissive, add restrictions; test thoroughly |
; | HSTS browser cache issues | If you must remove HSTS, wait max-age seconds, or use `delete` directive |

---

## 3. Checklist - Complete your learning

### Full checklist - mark each topic as completed:

```text
DNS, HTTPS and Reverse Proxies - Full Learning Checklist

☐ 1: How a browser finds a website (DNS resolution, IP addresses, ports)
☐ 2: DNS records (A, AAAA, CNAME, MX, TXT, NS, CAA, TTL, propagation)
☐ 3: HTTP basics (Host header, status codes, redirects)
☐ 4: What a proxy is (reverse proxy, forward proxy, load balancing)
☐ 5: TLS and HTTPS (certificates, CAs, chain of trust, handshake, SNI, HSTS)
☐ 6: Let's Encrypt and ACME (HTTP-01, TLS-ALPN-01, DNS-01, wildcard, renewal, rate limits, staging)
☐ 7: Caddy (Caddyfile, automatic HTTPS, reverse_proxy, headers, handle blocks, admin API)
☐ 8: Caddy On-Demand TLS (ask endpoint, tenant verification, abuse/risk mitigation)
☐ 9: Nginx (server blocks, proxy_pass, certbot, comparison with Caddy)
☐ 10: Forwarded headers (X-Forwarded-For, -Proto, -Host, trusting proxies, real client IP)
☐ 11: WebSockets, compression, caching, request size limits, timeouts, rate limiting
☐ 12: Redirects (HTTP to HTTPS, www vs non-www, redirect loops)
☐ 13: Custom domains for SaaS (end-to-end: DNS instructions, ownership verification, proxy serves it, cert issued, tenant from Host header; compare subdomain-per-tenant vs wildcard)
☐ 14: CDN and Cloudflare (proxied vs DNS-only, SSL modes, Flexible dangerous, caching)
☐ 15: Docker networking with a proxy (containers, internal ports, ports never exposed)
☐ 16: Security (firewall basics, subdomain takeover, dangling DNS, host header injection)
☐ 17: Troubleshooting (checklist for "my domain doesn't work")
☐ 18: Real-world patterns (full custom-domain flow, Next.js behind Caddy, zero-downtime reload, pitfalls of each)
```

---

## 4. Your proxy-learn project status

### Current project components:

```text
├── proxy-learn/
│   ├── app/              # Node.js Express app (port 3000)
│   │   ├── server.js     # App that echoes Host header
│   │   ├── package.json  # Dependencies (express)
│   │   └── Dockerfile    # Builds app image
│   ├── Caddyfile        # Caddy reverse proxy config (with local HTTPS)
│   ├── docker-compose.yml  # 3 services: app, caddy, nginx
│   ├── nginx/           # Nginx comparison config (HTTP only)
│   │   └── nginx.conf   # Nginx server blocks
│   ├── certs/           # Local CA certificates
│   │   ├── ca-cert.pem  # CA (localhost-CA)
│   │   ├── server-cert.pem  # Server cert (signed by CA)
│   │   └── server-key.pem  # Server private key
│   └── docs/            # 17 documentation chapters
│       ├── 00-roadmap.md     # Table of contents + checklist
│       ├── 01-how-browser-finds-website.md
│       ├── 02-dns-records.md
│       ├── 03-http-basics.md
│       ├── 04-what-proxy-is.md
│       ├── 05a-tls-https.md
│       ├── 05b-lets-encrypt-acme.md
│       ├── 06-caddy.md
│       ├── 07-caddy-ondemand-tls.md
│       ├── 08-nginx.md
│       ├── 09-forwarded-headers.md
│       ├── 10-websockets-compression-caching.md
│       ├── 11-redirects.md
│       ├── 12-custom-domains-saas.md
│       ├── 13-cdn-cloudflare.md
│       ├── 14-security.md
│       ├── 15-troubleshooting.md
│       └── 16-real-world-patterns.md
└── README.md  (generate me next!)
```

### How to run your project:

```bash
# From the proxy-learn directory:
; 1. Start all services
;    docker compose up -d

; 2. Verify they're running
;    docker compose ps

; 3. Test HTTPS through Caddy
;    curl -k https://app1.localhost/

; 4. Test HTTP through Nginx
;    curl http://localhost:8080/

; 5. Check the app sees correct headers
;    curl -k https://app1.localhost/headers

; 6. View all docs
;    ls docs/ | wc -l  # Should show 17 files

; 7. Stop when done
;    docker compose down
```

### Next steps for your learning:

```text
# 1. Review the roadmap (docs/00-roadmap.md) - check off completed topics
; 2. Re-read chapters where you need reinforcement
; 3. Experiment with your proxy-learn setup:
;    - Add new /etc/hosts entries for additional "tenants"
;    - Modify the Caddyfile and observe behavior
;    - Test different redirect configurations
;    - Practice the troubleshooting checklist
; 4. When ready, generate your README.md
; 5. Consider what to build next (real domain, Cloudflare integration, etc.)
```

---

## 5. Final thoughts

### What you've accomplished:

Through this learning journey, you've built a complete understanding of:

1. **How the internet works** - From DNS resolution to browser rendering
2. **DNS fundamentals** - Record types, propagation, CAA, and lookup tools
3. **HTTP fundamentals** - Request/response cycle, status codes, virtual hosting
4. **Proxy architecture** - Reverse proxy vs forward proxy, load balancing
5. **TLS/HTTPS essentials** - Certificates, CAs, chain of trust, handshake
6. **Let's Encrypt ACME** - Certificate automation, challenges, rate limits, staging
7. **Caddy configuration** - Caddyfile, automatic HTTPS, On-Demand TLS, admin API
8. **On-Demand TLS for SaaS** - The `ask` endpoint security model
9. **Nginx comparison** - Server blocks, proxy_pass, certbot, strengths/weaknesses
10. **Forwarded headers** - Trusted proxy configuration, client IP retrieval
11. **Advanced proxy features** - WebSockets, compression, caching, rate limits, timeouts
12. **Redirect management** - HTTP→HTTPS, www ↔ non-www, loop prevention
13. **SaaS custom domains** - End-to-end flow, DNS instructions, ownership verification
14. **CDN and Cloudflare** - Proxied vs DNS-only, SSL modes, caching strategies
15. **Docker networking** - Container communication, port exposure, service names
16. **Security fundamentals** - Firewalls, subdomain takeover, dangling DNS, header injection
17. **Troubleshooting methodology** - Systematic checklist, diagnostic commands
18. **Real-world patterns** - Complete flows, Next.js behind Caddy, zero-downtime reloads

### Your project (`proxy-learn/`) is ready:

- **3 services** running via Docker Compose: Node.js app, Caddy, Nginx
- **17 documentation chapters** covering beginner to advanced topics
- **Local CA** for HTTPS without real domains (using openssl)
- **/etc/hosts entries** for custom domain simulation
- **Verified working setup** - HTTPS through Caddy, HTTP through Nginx

### Next steps:

1. **Review the roadmap** (docs/00-roadmap.md) and mark topics as completed
2. **Experiment with your setup** - add new domains, modify configs, practice troubleshooting
3. **Generate a README.md** for your project
4. **Consider real-world deployment** - add Cloudflare, custom domains, production hardening
5. **Share your knowledge** - the docs you've created are valuable resources

---

*Complete. Documentation built, project configured, learning roadmap established.*