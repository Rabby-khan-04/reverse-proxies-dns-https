# docs/00-roadmap.md

# DNS, HTTPS and Reverse Proxies - Learning Roadmap

## Table of Contents (Beginner to Advanced)

| # | Topic | Key Concepts |
|---|-------|--------------|
| 1 | **How a browser finds a website** | IP addresses, ports, DNS resolvers, root servers, caching |
| 2 | **DNS records** | A, AAAA, CNAME, MX, TXT, NS, CAA, TTL, propagation, CNAME at apex, ALIAS/ANAME/flattening, using `dig` |
| 3 | **HTTP basics** | Host header, status codes, redirects |
| 4 | **What a proxy is** | Forward proxy vs reverse proxy, why they exist, load balancing |
| 5 | **TLS and HTTPS** | Certificates, CAs, chain of trust, handshake, SNI, HSTS |
| 6 | **Let's Encrypt and ACME** | HTTP-01, TLS-ALPN-01, DNS-01 challenges, wildcard certs, renewal, rate limits, staging |
| 7 | **Caddy** | Caddyfile, automatic HTTPS, `reverse_proxy`, headers, handle blocks, logging, admin API |
| 8 | **Caddy On-Demand TLS** | On-first-request cert issuance, `ask` endpoint, tenant verification, abuse and rate-limit risks |
| 9 | **Nginx** | Server blocks, `proxy_pass`, certbot, comparison with Caddy |
| 10 | **Forwarded headers** | `X-Forwarded-For`, `-Proto`, `-Host`, trusting proxies, getting real client IP |
| 11 | **WebSockets, compression, caching** | Proxy WebSocket support, compression, caching, request size limits, timeouts, rate limiting |
| 12 | **Redirects** | HTTP to HTTPS, www vs non-www, redirect loops |
| 13 | **Custom domains for SaaS** | End-to-end flow: merchant adds domain, DNS instructions, ownership verification, proxy serves it, cert issued, resolving tenant from Host header; compare subdomain-per-tenant vs wildcard cert |
| 14 | **CDN and Cloudflare** | Proxied vs DNS-only mode, SSL modes (Flexible dangerous), caching |
| 15 | **Docker networking with a proxy** | Containers, internal ports, which ports must never be exposed |
| 16 | **Security** | Firewall basics, subdomain takeover, dangling DNS, host header injection |
| 17 | **Troubleshooting** | Checklist: DNS propagation, wrong record, CAA blocking, port 80 blocked, cert errors, mixed content, redirect loops |
| 18 | **Real-world patterns** | Full custom-domain flow on local setup, Next.js app behind Caddy, zero-downtime config reload, pitfalls of each |
| 19 | **Checkbox checklist** | One checkbox per topic for tracking progress |

---

## Beginner Checklist

- [ ] 1: How a browser finds a website
- [ ] 2: DNS records and `dig`
- [ ] 3: HTTP basics and Host header
- [ ] 4: What a reverse proxy does
- [ ] 5: TLS/HTTPS fundamentals
- [ ] 6: Let's Encrypt ACME challenges (staging)
- [ ] 7: Caddyfile basics and reverse_proxy
- [ ] 13: Custom domains end-to-end flow

## Intermediate Checklist

- [ ] 8: Caddy On-Demand TLS and `ask` endpoint
- [ ] 9: Nginx server blocks vs Caddy
- [ ] 10: Forwarded headers and trust
- [ ] 11: WebSockets and caching at the proxy
- [ ] 12: Redirects and loop prevention
- [ ] 14: Cloudflare CDN and SSL modes

## Advanced Checklist

- [ ] 15: Docker networking and port exposure
- [ ] 16: Security: subdomain takeover, dangling DNS, header injection
- [ ] 17: Troubleshooting checklist
- [ ] 18: Real-world patterns and zero-downtime reloads

---

## How to Use This Roadmap

1. **Read each topic** in order from 1 to 19
2. **Build the project** in `proxy-learn/` as you read
3. **Complete the exercises** in each chapter (`docs/01-...md`)
4. **Check off each box** as you complete topics
5. **Repeat and experiment** with different configurations

## Project Setup

This roadmap accompanies the `proxy-learn/` project which includes:

- **Docker Compose**: `docker-compose.yml` - defines `app` (Node.js), `caddy`, and `nginx` services
- **Node.js app**: Simple Express app on port 3000 that echoes the Host header
- **Caddy**: Reverse proxy with automatic HTTPS using local CA
- **Nginx**: Comparison reverse proxy (HTTP only in current setup)
- **Local CA**: Generated with openssl for HTTPS without real domains
- **/etc/hosts entries**: `app1.localhost`, `app2.localhost`, `api.localhost` → 127.0.0.1

## Local Development Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs <service-name>

# Test Caddy HTTPS
curl -k https://app1.localhost/

# Test with dig/nslookup
dig app1.localhost
nslookup app1.localhost

# View Caddy admin API
curl http://localhost:2019/config
```

---

*Run every config and command before putting it in the docs. Never change real DNS records or real servers. Always use the Let's Encrypt staging environment for any real-issuance examples.*