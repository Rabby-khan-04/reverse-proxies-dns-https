# docs/02-dns-records.md

## 1. Simple explanation (like I'm 7)

DNS records are like a phone book for the internet. They tell your computer how to find websites. Here are the most important ones:

- **A record**: Like a phone number for IPv4 (looks like `127.0.0.1`)
- **AAAA record**: Like a phone number for IPv6 (longer address with lots of colons and numbers)
- **CNAME record**: Like a nickname. "api.example.com" is also known as "www.example.com"
- **TXT record**: Like a sticky note. People can leave messages here (used for ownership verification)
- **MX record**: For email. Says "send email for `@example.com` to this mail server"
- **NS record**: Who's in charge. "These name servers know about `example.com`"
- **CAA record**: Security. "Only these Certificate Authorities can issue HTTPS certs for this domain"
- **TTL**: How long the phone number can be remembered before asking again

Think of TTL like "how long is this phone number good for?" After TTL expires, you have to ask again.

---

## 2. Real name

**DNS records** are entries in a zone file that tell the DNS system how to handle a domain name. Each record type has a specific purpose:

| Record | Purpose | Example |
|--------|---------|---------|
| **A** | Maps domain to IPv4 address | `app1.localhost IN A 127.0.0.1` |
| **AAAA** | Maps domain to IPv6 address | `app1.localhost IN AAAA ::1` |
| **CNAME** | Alias/CNAME canonical name | `www IN CNAME app1.localhost` |
| **TXT** | Free-form text (ownership, verification) | `default._domainkey IN TXT "v=K1"` |
| **MX** | Mail exchange (where to deliver email) | `@ IN MX mail.example.com.` |
| **NS** | Name server (authoritative DNS) | `@ IN NS ns1.example.com.` |
| **CAA** | Certificate Authority Authorization | `_domainkey IN CAA 0 issue "letsencrypt.org"` |
| **TTL** | Time to Live (cache duration) | `IN TTL 300` (5 minutes) |

**Key concepts**:
- **`@`** represents the apex/root domain (e.g., `example.com` without subdomain)
- **`IN`** means Internet class (standard)
- **`TTL`** is in seconds; `300` = 5 minutes, `3600` = 1 hour, `86400` = 1 day

---

## 3. Config example

### DNS record examples (what you'd put in your domain's zone file)

Since we're using `/etc/hosts` instead of real DNS, here are the equivalents:

**A record (via /etc/hosts)** - already covered in chapter 1:

```text
# /etc/hosts equivalent of an A record
127.0.0.1   app1.localhost
127.0.0.1   app2.localhost
```

**CNAME record example (what you'd use for SaaS custom domains)**:

If a merchant wants `store.example.com` to point to your SaaS proxy:

```text
; DNS zone file for example.com
; Merchant's custom domain setup
store       IN  CNAME    app1.localhost.
;              ^          ^
;              |          +-- points to your proxy subdomain
;              +-- this is the merchant's subdomain
```

**TXT record for ownership verification**:

```text
; Used by Let's Encrypt DNS-01 challenge or SaaS ownership verification
_acme-challenge  IN  TXT    "random-string-12345"
;              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
;              This value is provided by the proxy/Caddy when verifying ownership
```

**CAA record to allow only Caddy to issue certs**:

```text
; Only Caddy (or this CA) can issue HTTPS certs for this domain
_domainkey  IN  CAA    0 issue "letsencrypt.org"
;              0    = "issue" flag (allows cert issuance)
;              "letsencrypt.org" = only Let's Encrypt can issue
```

**MX record for email**:

```text
; Email routing for example.com
@   IN  MX  10  mail.example.com.
;  ^    ^-- priority (lower = preferred)
;  +-- the mail server hostname (must have A record)
```

### Docker Compose doesn't directly configure DNS records

But you can see how extra_hosts works:

```yaml
services:
  app:
    extra_hosts:
      - "app1.localhost:127.0.0.1"
```

This adds an `/etc/hosts`-equivalent entry for the container.

---

## 4. Commands and what you should see

### Query all record types for a domain

```bash
# Query A record (IPv4)
dig app1.localhost A

; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;app1.localhost.                IN      A

;; ANSWER SECTION:
app1.localhost.       0       IN      A       127.0.0.1

;; WHEN: Wed Oct 28 10:30:00 2026
;; TTL: 0 (0 mins 0 secs)
```

```bash
# Query CNAME record
dig app1.localhost CNAME

; (No CNAME answer if A record exists directly)
```

```bash
# Query TXT record
dig _acme-challenge.app1.localhost TXT

; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;_acme-challenge.app1.localhost. IN TXT

;; ANSWER SECTION:
_acme-challenge.app1.localhost. 0 IN TXT "random-1234-abcd"
```

```bash
# Query NS records (name servers)
dig example.com NS

; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;example.com.                   IN      NS

;; AUTHORITY SECTION:
example.com.        3600  IN  NS  ns1.example.com.
example.com.        3600  IN  NS  ns2.example.com.
```

```bash
# Query CAA records
dig app1.localhost CAA

; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;app1.localhost.                IN      CAA

;; ANSWER SECTION:
app1.localhost.       3600  IN  CA  0 issue "ca.example.com"
;              3600 = TTL of 1 hour
;              IN = Internet class
;              CA = Certificate Authority flag
;              0 issue = "only this CA can issue certs"
```

```bash
# Query MX records
dig example.com MX

; <<>> APPENDIX <<>> 
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345
;; QUESTION SECTION:
;example.com.                   IN      MX

;; ANSWER SECTION:
example.com.        3600  IN  MX  10  mail.example.com.
example.com.        3600  IN  MX  20  backup-mail.example.com.
```

```bash
# Query AAAA records (IPv6)
dig app1.localhost AAAA

; (No answer if only IPv4 is in /etc/hosts)
;; ANSWER SECTION:  (empty - no AAAA record found)
```

### Key output fields to understand:

| Field | Meaning |
|-------|---------|
| `;` | Comment line (everything after semicolon is ignored) |
| `<<>>` | dig version/info |
| `opcode: QUERY` | Type of request |
| `status: NOERROR` | Request succeeded |
| `id: 12345` | Transaction ID (matches request/response) |
| `QUESTION SECTION` | What are we asking for? |
| `ANSWER SECTION` | The actual record data |
| `name.` | Fully qualified domain name (trailing dot) |
| `IN` | Internet class |
| `A/AAAA/CNAME/TXT/MX/CAA` | Record type |
| `value` | The data (IP, hostname, text, etc.) |
| `TTL` | How long to cache this answer |

---

## 5. In a real multi-tenant SaaS

### Custom domain flow with DNS records:

1. **Merchant adds domain**: They enter `store.example.com` in your SaaS dashboard
2. **You show DNS instructions**: 
   - "Add a CNAME record: `store.example.com → proxy.your-saas.com`"
   - OR "Add an A record: `store.example.com → 1.2.3.4`"
3. **Merchant adds the record** at their domain registrar (GoDaddy, Cloudflare, etc.)
4. **You verify ownership**: 
   - For HTTP-01: Your proxy responds to `http://store.example.com/.well-known/acme-challenge/...`
   - For DNS-01: You check for a TXT record: `_acme-challenge.store.example.com TXT "random-value"`
   - For CAA: Check that CAA allows your CA to issue certs
5. **DNS propagates**: TTL determines how long old records stick around (typically 5 min to 24 hours)
6. **Proxy receives request**: `Host: store.example.com` header
7. **App resolves tenant**: Look up which merchant owns `store.example.com`
8. **HTTPS is served**: Certificate issued (via Caddy automatic HTTPS or pre-provisioned)

### Comparing record types for SaaS:

| Scenario | Best record type | Why |
|----------|-----------------|-----|
| One subdomain per merchant | CNAME | Easy to point any subdomain to your proxy |
| Root domain (example.com) | A record (ALIAS/ANAME) | Some registrars don't allow CNAME at apex |
| Wildcard certificate | CNAME + ALIAS | `*.example.com` works with ALIAS flattening |
| Email per tenant | MX record | Route email to tenant-specific servers |
| Domain verification | TXT record | Prove you control the domain (Let's Encrypt, etc.) |

---

## 6. When to use it and when NOT to

**Use DNS record knowledge when**:
- Setting up custom domains for SaaS merchants
- Configuring Let's Encrypt certificates (HTTP-01 or DNS-01 challenges)
- Debugging "domain not resolving" issues
- Migrating between DNS providers
- Setting up email routing (MX records)

**NOT to change real DNS without testing**:
- Always test with `dig` first before changing production records
- Use `dig +short` for quick lookups
- Your `proxy-learn/` setup uses `/etc/hosts` - no real DNS changes needed

---

## 7. Common mistakes

- **CNAME at the apex problem**: You can't put a CNAME record at the root domain (`example.com`). Use ALIAS, ANAME, or DNS flattening instead.
- **Ignoring TTL**: If TTL is 24 hours, DNS changes take up to 24 hours to propagate. Lower TTL before making changes.
- **Forgetting the trailing dot**: NS records need a trailing dot (`ns1.example.com.`) but CNAME records typically don't have one.
- **CAA blocking HTTPS**: If CAA records exist and don't allow your CA, Let's Encrypt will refuse to issue certificates.
- **Mixing record types**: Having both A and CNAME for the same name can cause issues (usually CNAME wins).
- **Using `nslookup` for everything**: `dig` gives much more detailed and reliable output.

---

## 8. Try it yourself

**Exercise**: Query different DNS record types and observe the output.

```bash
# 1. Look up A record
dig app1.localhost A +short

; Expected output:
127.0.0.1

# 2. Look up TXT record (for acme-challenge)
dig _acme-challenge.app1.localhost TXT +short

; Expected output:
"random-string-12345"

# 3. Look up CAA record
dig app1.localhost CAA +short

; Expected output (no CAA = can use any CA):
; (empty output)

# 4. Look up MX record for a domain
dig google.com MX +short

; Expected output:
10 smtp.google.com.
50 alt1.google.com.
50 alt2.google.com.

# 5. Look up NS records
dig example.com NS +short

; Expected output (your nameservers):
ns1.your-dns-provider.com.
ns2.your-dns-provider.com.
```

**Hint**: If you get `SERVFAIL` or no answer:
1. Make sure the Docker containers are running (`docker compose ps`)
2. Check `/etc/hosts` has the correct entries
3. For real domains, verify the domain exists and has DNS records configured

**Cleanup**: No cleanup needed - these commands only read DNS information.

---

## Next

[[03-http-basics]] - Learn about the Host header, status codes, and redirects.