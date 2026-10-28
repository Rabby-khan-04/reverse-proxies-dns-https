# docs/01-how-browser-finds-website.md

## 1. Simple explanation (like I'm 7)

When you type `http://app1.localhost/` in your browser, it goes on a treasure hunt to find your website:

1. **Your computer asks**: "Where can I find app1.localhost?" It talks to a DNS resolver (like asking a librarian).
2. **The resolver asks the root server**: "Where do I look for the `.localhost` part?" The root server points to the TLD server.
3. **The TLD server says**: "For `.localhost`, ask the authoritative server." The authoritative server knows the IP address.
4. **Your computer gets the IP**: It's usually `127.0.0.1` (your own computer!) because we added it to `/etc/hosts`.
5. **Now your computer connects**: It goes to that IP on port 80 (HTTP) or 443 (HTTPS), sends a request, and the web server answers.

Think of it like calling a friend: you look up their phone number (DNS), then you call them (connect to the IP), and they answer (web server sends the page).

---

## 2. Real name

**DNS resolution**: The process of translating a human-readable domain name (like `app1.localhost`) into an IP address (like `127.0.0.1`) so computers can find each other on the network.

**Key terms**:
- **Resolver**: Your computer's DNS client (usually provided by your ISP or Google/Cloudflare)
- **Root servers**: The top of the DNS hierarchy - there are 13 logical root server locations
- **TLD servers**: Top-Level Domain servers (like `.com`, `.org`, `.localhost`)
- **Authoritative server**: The server that actually knows the IP address for a domain
- **A record**: Maps a domain name to an IPv4 address
- **AAAA record**: Maps a domain name to an IPv6 address
- **TTL (Time to Live)**: How long a DNS answer can be cached before it must be refreshed

---

## 3. Config example

### /etc/hosts entries (already in your project)

Add these to your `/etc/hosts` file (on Linux/Mac: `/etc/hosts`, on Windows: `C:\Windows\System32\drivers\etc\hosts`):

```text
127.0.0.1   app1.localhost
127.0.0.1   app2.localhost
127.0.0.1   api.localhost
```

This tells your computer to always resolve these hostnames to your own machine.

### Docker Compose extra_hosts (already in docker-compose.yml)

```yaml
services:
  app:
    build: ./app
    extra_hosts:
      - "app1.localhost:127.0.0.1"
      - "app2.localhost:127.0.0.1"
```

### Commands and what you should see

```bash
# Look up the IP address for app1.localhost
dig app1.localhost

; <<>> APPENDIX <<>>
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;app1.localhost.                IN      A

;; ANSWER SECTION:
app1.localhost.       0       IN      A       127.0.0.1

;; WHEN: Wed Oct 28 10:30:00 2026
;; TTL: 0 (0 mins 0 secs)
```

You should see `ANSWER SECTION: app1.localhost. 0 IN A 127.0.0.1` and `TTL: 0` because `/etc/hosts` takes precedence and has TTL 0.

```bash
# Look up DNS info for app1.localhost
nslookup app1.localhost

Server:    127.0.0.11
Address:  127.0.0.11#53

Name:      app1.localhost
Address: 127.0.0.1
```

---

## 5. In a real multi-tenant SaaS

When a new merchant signs up, you need their domain to work. The flow is:

1. Merchant adds their domain (e.g., `store.example.com`) to your SaaS dashboard
2. You show them DNS instructions: "Add a CNAME record pointing `store.example.com` to your proxy domain"
3. Merchant adds the DNS record at their domain registrar
4. Your system checks that the domain resolves to your proxy (using `dig` or `nslookup`)
5. The proxy receives the request with the `Host: store.example.com` header
6. Your app looks up which tenant owns that domain and serves the right content

---

## 6. When to use it and when NOT to

**Use this knowledge when**:
- Setting up custom domains for SaaS merchants
- Debugging why a domain isn't loading
- Configuring DNS records for your own services
- Understanding how browsers locate websites

**NOT to use real DNS changes**:
- Never change production DNS records without proper testing
- Always use staging environments for learning
- Your `proxy-learn/` setup uses `/etc/hosts` - never modify real domain zone files

---

## 7. Common mistakes

- **Forgetting `/etc/hosts`**: Without the host entry, `app1.localhost` won't resolve to `127.0.0.1`
- **Misreading `dig` output**: The answer section shows the IP; the authority section shows name servers
- **Ignoring TTL**: Low TTL means changes propagate fast; high TTL means changes take longer to take effect
- **Using `nslookup` vs `dig`**: `nslookup` is older; `dig` gives more detailed output

---

## 8. Try it yourself

**Exercise**: Look up the DNS records for your own subdomains.

```bash
# From your proxy-learn directory
dig app1.localhost

# Expected output you should see:
; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id:...
;; QUESTION SECTION:
;app1.localhost.                IN      A

;; ANSWER SECTION:
app1.localhost.       0       IN      A       127.0.0.1

;; WHEN: ...
;; TTL: 0
```

**Hint**: If you see `SERVFAIL` or no answer, check that:
1. The `/etc/hosts` entries are correct
2. Docker containers are running (`docker compose ps`)
3. You're running the command on the same machine as the `/etc/hosts` file

**Cleanup**: No cleanup needed - this just reads your existing `/etc/hosts` file.

---

## Next

[[02-dns-records]] - Learn about DNS records (A, AAAA, CNAME, MX, TXT, NS, CAA, TTL, propagation) and use `dig` to query them.