# SECURITY_GUARDRAILS.md - OpenHunterAI

> Bat buoc cho moi implementation, worker, AI reasoning, report, retest va scan job. Neu co conflict, file nay uu tien cao nhat.

---

# 1. Nguyen tac toi cao

## 1.1. No verified authorization, no scan

Khong tao scan job neu:

```text
- Domain chua verified.
- Verification da expired.
- User chua tao scan authorization.
- Target nam ngoai allowed scope.
- Target la private/local/metadata IP.
```

## 1.2. Authorized attacker-mindset, governed execution

OpenHunterAI mo phong tu duy attacker, nhung moi action phai nam trong:

```text
- verified domain / hostname
- allowed hosts
- allowed paths
- scan authorization
- package permission
- budget/runtime limits
- Product Policy Gate
- User Approval Gate neu nhay cam
```

## 1.3. Forbidden actions

Khong bao gio cho phep:

```text
- scan ngoai scope
- scan private/internal/local/metadata target
- destructive action mac dinh
- credential attack
- brute-force
- DoS
- malware
- persistence
- stealth/evasion
- data exfiltration
- raw credential/secret logging
- raw evidence persistence
- huong dan lam dung co kha nang operationalize attack ngoai scope
```

## 1.4. Black-hat mindset definition

"Black-hat" in this project means adversarial reasoning style, not unauthorized execution.

Allowed mindset:
- abuse-path thinking;
- hypothesis generation;
- access-control suspicion;
- API behavior probing;
- unexpected-risk discovery.

Forbidden execution remains forbidden:
- unauthorized access;
- out-of-scope scan;
- destructive action;
- credential attack;
- persistence;
- evasion;
- malware;
- exfiltration.

---

# 2. Domain, URL va scope guardrails

## 2.1. Domain verification bat buoc

V1 ho tro:

```text
- DNS TXT verification
- /.well-known file verification
```

## 2.2. URL normalization bat buoc

Truoc moi scan/retest:

```text
- normalize scheme
- normalize hostname
- remove userinfo
- remove fragment
- resolve/inspect redirect neu can
- check hostname thuoc allowed scope
- reject unsupported scheme
```

Chi ho tro:

```text
http
https
```

## 2.3. Chan target nguy hiem

Khong scan:

```text
localhost
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
::1
fc00::/7
fe80::/10
cloud metadata endpoints
file://
ftp://
gopher://
```

## 2.4. Redirect guardrail

Neu target redirect ra ngoai allowed scope:

```text
- chan action
- ghi audit log
- hien thi loi ro rang
- khong follow redirect ngoai scope
```

---

# 3. Scan authorization guardrails

Moi scan phai co authorization snapshot:

```text
- project_id
- user_id
- verified_domain_id
- scan_package
- allowed_hosts
- allowed_paths
- excluded_paths
- test_account_permission
- sensitive_action_permission
- package/budget limits
- created_at
- expires_at neu co
```

Scan/retest dung snapshot nay, khong doc scope moi de thay doi in-flight job.

---

# 4. Credential va secret guardrails

## 4.1. Khong luu plain text

Khong luu plain text:

```text
- password
- token
- cookie
- API key
- session secret
- raw test account credential
```

Credential phai duoc ma hoa.

## 4.2. Khong log secrets

Khong log:

```text
- raw password
- raw token
- raw cookie
- raw API key
- full Authorization header
- raw session value
- raw prompt co du lieu nhay cam
```

## 4.3. Khong dua secrets vao LLM prompt

LLM chi nhan compact sanitized context. Khong dua:

```text
- raw password
- raw cookie
- raw token
- raw API key
- Authorization header
- raw private data
- raw request/response nhay cam
```

DeepSeek V4 Flash and DeepSeek V4 Pro only receive compact sanitized context.
Flash is for triage/ranking.
Pro is for reasoning supervisor.
No raw HAR, raw request/response, raw cookie, raw token, raw credential or raw private data may be sent to either model.

## 4.4. Test account

Test account chi dung khi:

```text
- login URL thuoc verified scope
- user da consent dung test account
- credential duoc ma hoa
- worker dung credential qua vault/session abstraction
- khong persist raw credential hoac session secret
```

---

# 5. Evidence va storage guardrails

## 5.1. No raw evidence persistence

Production khong persist:

```text
- raw request/response
- raw HAR
- raw cookie jar
- raw browser storage values
- raw token
- raw credential
- raw private user data
```

Workers co the xu ly raw data trong memory de tao summary, nhung phai sanitize truoc khi ghi DB/object storage/report/LLM prompt.

## 5.2. Duoc luu

Chi luu:

```text
- sanitized findings
- sanitized reports
- sanitized evidence summaries
- sanitized screenshots neu khong lo PII/secret
- coverage gaps
- tool metadata
```

## 5.3. Report wording

Khong ghi cac ket luan tuyet doi nhu:

```text
Website an toan tuyet doi.
Khong co van de nao.
```

Ghi:

```text
Khong phat hien Critical/High trong pham vi kiem thu hien tai.
```

Va neu ro:

```text
- scope da kiem thu
- coverage
- limitations
- what we could not test
- next step
```

---

# 6. Worker guardrails

Moi worker phai co:

```text
- timeout
- retry limit
- rate limit neu can
- max requests / max evidence size neu can
- structured logs
- scan_id
- project_id
- worker_type
- error handling
```

Khong worker nao duoc:

```text
- chay vo han
- silently fail
- fake success
- tao finding gia de UI co du lieu
- dung mock result trong production path
- scan ngoai scope
```

Tool unavailable phai ghi `skipped` hoac equivalent coverage gap, khong duoc fake output.

---

# 7. Tool guardrails

## 7.1. Browser / Playwright

```text
- browser context rieng cho moi scan/account
- block navigation ngoai scope
- khong persist raw credential/session
- khong tu click destructive action neu chua approval
- concurrency thap va timeout cung trong production
```

## 7.2. ZAP

V1 chi dung:

```text
- passive scan
- baseline scan
- selected safe checks neu cau hinh ro
```

Khong broad active scan mac dinh.

## 7.3. Nuclei

Chi dung internal curated templates.

Khong chay template:

```text
- destructive
- intrusive
- brute-force
- DoS
- malware
- credential attack
```

---

# 8. Strix va OpenHack guardrails

## 8.1. Strix

Strix duoc phep:

```text
- doc compact sanitized context
- tao attacker hypotheses
- de xuat validation action
- phan loai severity/confidence
- de xuat remediation
- tao retest scenario
```

Strix khong duoc:

```text
- scan ngoai scope
- tu chay destructive action
- tu goi endpoint nhay cam khi chua co approval
- nhan raw secret
- tao huong dan lam dung ngoai scope
- vuot runtime/tool/token budget
```

## 8.2. OpenHack-style workflow

Dung de:

```text
- mini hunter tasks
- schema hoa finding/warning/hardening/coverage gap
- ho tro report va retest package
```

Khong dung OpenHack de mo rong scope scan.

---

# Free Hunter guardrails

Free Hunter must:
- use the same quality workflow class as paid checks;
- stop after first valuable finding;
- return at most 1 finding;
- allow at most 1 monitored finding;
- allow at most 1 retest for that finding;
- require 7-day cooldown before searching a new finding unless upgraded;
- require deleting old monitored finding before monitoring another finding in Free.

Free Hunter must not:
- expose full paid finding board;
- run full paid adversarial depth;
- run multi-account authenticated checks;
- bypass package budget.

---

# 9. User Approval Gate

Bat buoc approval neu action:

```text
- dung test account cho validation nhay cam
- kiem tra access-control
- goi POST/PUT/PATCH/DELETE
- lien quan billing/payment
- lien quan file upload/delete/export
- lien quan email/webhook
- retest High/Critical finding
- co the thay doi du lieu
```

Approval phai hien:

```text
- finding/action can chay
- domain/host/path lien quan
- account nao duoc dung
- action nao se thuc hien
- action nao se khong thuc hien
- rui ro con lai
- approve/cancel
```

Neu user cancel, action khong chay va audit log ghi denied.

---

# 10. Retest guardrails

V1 retest la manual queue theo finding, ke ca trong Monitor.

Khong implement:

```text
- CI/CD-based automated retesting
- deployment-triggered retest
- background full-app retest
- automated retest for all findings
```

Moi retest phai co:

```text
- finding_id
- scenario_ref
- scope_snapshot
- expected result
- max runtime
- approval state neu sensitive
```

---

# 11. Audit log bat buoc

Ghi audit log cho:

```text
- domain verification created/success/fail
- scan authorization created
- scan started/completed/failed
- scan step skipped/failed for tool unavailable
- test account added/deleted
- user approval accepted/denied
- retest queued/started/completed
- report generated/exported
- finding status changed
```

---

# 12. Production block conditions

Khong release neu con:

```text
- scan domain chua verified
- scan private/local/metadata IP
- redirect ngoai scope van bi follow
- raw credential trong log/report/prompt/storage
- raw evidence persistence
- Strix nhan raw secret
- Strix/action nhay cam khong qua policy/approval
- retest ngoai finding scope
- production tra mock result
- worker khong timeout
- report khong sanitize evidence
```
