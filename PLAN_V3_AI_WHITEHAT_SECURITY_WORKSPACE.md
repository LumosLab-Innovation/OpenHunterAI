# PLAN_V3.md — AI White-hat Security Workspace

> Bản này là plan mới từ đầu, không phụ thuộc plan cũ.  
> Scope v1 được chốt hẹp: **authorized external web/app security testing cho domain đã xác minh, có thể thêm test account, không làm GitHub/Jira/CI-CD/VPS/cloud trong v1.**

---

# 0. Chốt quyết định sản phẩm

## 0.1. Sản phẩm là gì?

**AI White-hat Security Workspace** là nền tảng cho phép người dùng:

```text
Nhập domain
→ xác minh quyền sở hữu
→ khai báo phạm vi kiểm thử
→ thêm test account nếu muốn
→ AI White-hat kiểm thử web/app có kiểm soát
→ nhận report dễ hiểu + report kỹ thuật cho AI/dev
→ quản lý lỗi
→ fix từng lỗi
→ manual retest từng lỗi
```

## 0.2. Scope v1

V1 chỉ làm:

```text
Authorized external web/app testing
```

Cụ thể:

```text
- public domain / public web app
- domain đã xác minh quyền sở hữu
- optional test account do user cung cấp
- browser-based inspection
- passive/baseline DAST signal
- safe template signal
- Strix attacker-mindset reasoning
- OpenHack-style hunter workflow
- report 2 bản
- finding board
- manual retest từng finding
```

## 0.3. Không làm trong v1

```text
- Không GitHub repo access
- Không Jira / Linear
- Không CI/CD auto retest
- Không Vercel/GitHub deploy-triggered retest
- Không VPS / instance verification
- Không cloud account verification
- Không private network scan
- Không cài agent lên server
- Không Semgrep / Trivy / Gitleaks
- Không DefectDojo production integration
- Không secureCodeBox / Kubernetes orchestration phức tạp
- Không mobile APK audit
```

Lý do: v1 phải tập trung vào một sản phẩm có thể bán được, không biến thành DevSecOps/cloud security platform.

---

# 1. Product Positioning

## 1.1. One-liner

```text
AI White-hat Security Workspace giúp startup, agency và vibe-coded app kiểm thử bảo mật web/app có kiểm soát bằng AI attacker-mindset, nhận report dễ hiểu, report cho AI/dev và retest từng lỗi sau khi sửa.
```

## 1.2. Không dùng wording này

```text
Black-hat tool
Auto hack
Exploit bot
Malware simulator
Attack any website
CI/CD security platform
Cloud security platform
```

## 1.3. Wording nên dùng

```text
AI White-hat
Attacker-mindset simulation
Authorized security testing
Hunter Snapshot
Safe retest
Evidence-based report
Finding workspace
```

## 1.4. Core product loop

```text
Discover → Explain → Fix → Retest → Prove
```

Chưa dùng:

```text
Discover → Explain → Fix → Auto CI/CD Retest → Continuous DevSecOps
```

CI/CD auto retest để sau, không nằm trong v1.

---

# 2. Chốt stack v1

## 2.1. Không chỉ dùng Strix

Chốt:

```text
Không chỉ dùng Strix, nhưng Strix là lõi khác biệt.
```

## 2.2. Core v1 stack

| Thành phần | Vai trò |
|---|---|
| **Strix** | AI attacker-mindset core, tạo giả thuyết, phân tích bất thường, tìm lỗi logic/phân quyền |
| **OpenHack** | Free Hunter workflow, expert manifests, schema, review package |
| **Playwright / CDP** | Mở browser thật, login, inspect network/console/cookie/storage/DOM |
| **OWASP ZAP** | Passive/baseline scanner, tạo tín hiệu kỹ thuật rẻ |
| **Nuclei** | Curated safe templates cho exposure/misconfig/known pattern |
| **SaaS core tự build** | verify domain, scope, dashboard, report, finding board, retest, billing |

## 2.3. Vai trò chính xác

```text
Strix = não attacker-mindset
OpenHack = phương pháp săn lỗi / schema / expert workflow
Playwright = mắt và tay trong browser
ZAP = tín hiệu DAST nền
Nuclei = tín hiệu template nhanh
SaaS core = sản phẩm hóa
```

## 2.4. Không để ZAP/Nuclei thay Strix

ZAP/Nuclei dùng để tìm lỗi phổ biến và giảm tải chi phí.  
Strix dùng cho thứ tạo khác biệt:

```text
- business logic bug
- BOLA / IDOR
- role bypass
- auth/session flow
- API trả dư dữ liệu
- endpoint ẩn
- hành vi bất thường sau login
- lỗi không nằm trong checklist cố định
```

---

# 3. Guardrails và policy

## 3.1. Không bó cứng Strix bằng checklist

Quy tắc:

```text
Strix được tự do suy luận như attacker.
Product chỉ kiểm soát phạm vi, quyền hành động, chi phí và consent.
```

Không làm:

```text
Strix chỉ được chạy checklist A/B/C.
```

Làm:

```text
Strix tự do tạo giả thuyết
→ nếu muốn hành động thì request qua Product Policy Gate
→ Policy Gate cho phép / chặn / yêu cầu user approval
```

## 3.2. Tách 2 lớp

### A. Strix internal guardrails

Do Strix tự có:

```text
- agent sandbox
- tool control
- workflow guardrails
- internal safety constraints
```

Không cố build lại toàn bộ nếu Strix đã có.

### B. Product Policy Gate

Do sản phẩm của mình cần có:

```text
- domain đã verify chưa?
- host/path có trong scope không?
- gói này có được authenticated scan không?
- action có dùng test account không?
- action có đụng billing/payment/file upload/email không?
- action có destructive không?
- action có vượt time/compute/token budget không?
- user có approve action này chưa?
```

## 3.3. Nguyên tắc

```text
Free reasoning, governed execution.
```

---

# 4. Domain verification và scope

## 4.1. V1 chỉ cần domain/host verification

V1 không cần VPS/instance verification.

Dùng:

```text
- DNS TXT
- /.well-known file
```

Có thể thêm sau nếu muốn:

```text
- HTML meta
- CNAME
- Cloudflare/Vercel OAuth
```

Nhưng v1 nên tập trung DNS TXT + well-known file.

## 4.2. Khi DNS TXT là đủ?

DNS TXT đủ cho:

```text
- scan public domain
- scan declared subdomains trong scope
- browser inspect
- authenticated testing bằng test account
- scheduled/manual monitoring sau này
```

## 4.3. Khi cần VPS/instance verification?

Không trong v1.

Chỉ cần nếu sau này làm:

```text
- server agent
- private network scan
- SSH audit
- cloud config audit
- log-based analysis
- container/runtime scan
```

## 4.4. Scope model

User phải khai báo:

```text
- allowed hosts
- excluded hosts
- allowed paths
- excluded paths
- scan profile
- có dùng test account không
- có được gọi action nhạy cảm không
- scan window nếu cần
```

Ví dụ:

```text
Allowed:
- https://example.com
- https://app.example.com

Excluded:
- /billing/delete
- /admin/destructive-actions
- /webhooks/production
```

## 4.5. Không scan nếu

```text
- domain chưa verify
- redirect ra ngoài scope
- target là private/local/metadata IP
- scheme không phải http/https
- target không thuộc allowed hosts
```

---

# 5. User Approval Gate vs Expert Human Review

## 5.1. Không gọi nhầm

Cái user bấm đồng ý không gọi là human review.

Gọi là:

```text
User Approval Gate
Action Confirmation
Human-in-the-loop Approval
```

## 5.2. User Approval Gate là gì?

Là feature để user approve trước khi AI chạy action nhạy cảm.

Ví dụ:

```text
AI muốn retest lỗi phân quyền FIND-003 bằng 2 test accounts.
Bạn có đồng ý không?
```

Áp dụng khi:

```text
- dùng test account
- kiểm tra endpoint nhạy cảm
- kiểm tra access-control
- dùng POST/PUT/DELETE
- kiểm tra billing/payment/file upload
- retest lỗi High/Critical
```

## 5.3. Expert Human Review là gì?

Là có người có chuyên môn bảo mật review lại finding/report.

Không có mặc định ở v1 nếu chưa có người review thật.

Dùng cho:

```text
- gói Launch Audit
- add-on cho Standard/Auth
- finding High/Critical nếu khách trả thêm
- report dùng để gửi khách hàng B2B/investor
```

## 5.4. Bảng thuật ngữ

| Khái niệm | Ai làm? | Là feature hay benefit? |
|---|---|---|
| User Approval Gate | User | Feature kiểm soát |
| Expert Human Review | Security reviewer | Benefit / add-on cao cấp |
| Risk Acceptance | User | Feature quản trị |
| Ready for Retest | User/dev | Workflow state |
| Retest Result | System/AI/reviewer | Kết quả xác minh |

---

# 6. Free Hunter Layer

## 6.1. Vấn đề

Free không thể chạy full Strix vì tốn token/compute.  
Nhưng Free cũng không được chỉ check header/cookie rẻ tiền, nếu không user sẽ không thấy “chất hunter”.

## 6.2. Giải pháp

Tạo:

```text
Free Vibe-code Hunter Snapshot
```

Dùng:

```text
- Playwright browser inspect nhẹ
- ZAP passive mini
- Nuclei mini safe templates
- OpenHack-style hunter workflow
- Strix Mini Summary
```

## 6.3. OpenHack dùng cho Free làm gì?

OpenHack không thay Strix. OpenHack dùng để tạo workflow “hunter có cấu trúc”:

```text
- expert manifests
- mini hunter tasks
- finding/warning/coverage schema
- report sections
- review package format
```

## 6.4. Các mini hunter trong Free

### Hunter 1 — Vibe-code Exposure Hunter

Check:

```text
- public sourcemap
- exposed .env/config/debug routes
- framework default page
- stack trace/error page
- admin/test route public
- backup/temp files
```

### Hunter 2 — Frontend Secret & Storage Hunter

Check:

```text
- token-like value trong localStorage/sessionStorage
- API key pattern trong JS bundle
- NEXT_PUBLIC / VITE exposed variable risk
- console log chứa dữ liệu nhạy cảm
- public JS bundle risk
```

### Hunter 3 — API Surface Hunter

Check:

```text
- frontend gọi bao nhiêu endpoint /api/*
- endpoint có object id pattern
- endpoint admin-like
- response có role/owner_id/email/token-like fields
- status 401/403/500 bất thường
```

### Hunter 4 — Auth/Session Smoke Hunter

Check:

```text
- cookie thiếu HttpOnly/Secure/SameSite
- session token trong URL
- localStorage token risk
- login/logout route detection
- mixed http/https auth flow
```

### Hunter 5 — AI App Smoke Hunter

Chỉ bật nếu phát hiện app có chatbot/LLM.

Check an toàn:

```text
- có chatbot/input AI không
- có dấu hiệu tool/action không
- có confirmation trước action nhạy cảm không
- có response lộ debug/system-like text không
```

## 6.5. Free output phải luôn có giá trị

Không trả:

```text
Không phát hiện lỗi.
```

Trả:

```text
Không phát hiện Critical/High trong phạm vi snapshot public.
```

Kèm:

```text
- đã kiểm tra gì
- đã quan sát bao nhiêu route/request/API
- warnings/hardening nếu có
- risk areas đáng chú ý
- phần chưa kiểm tra được
- bước tiếp theo
```

## 6.6. Free không được gọi là pentest

Tên nên dùng:

```text
Free Vibe-code Hunter Snapshot
```

Không dùng:

```text
Free Pentest
Free Full Strix Scan
```

---

# 7. Scan pipeline v1

## 7.1. Tổng quan

```text
User nhập domain
  ↓
Verify domain
  ↓
Scope + authorization
  ↓
Optional test account
  ↓
Playwright Browser Inspector
  ↓
ZAP passive/baseline
  ↓
Nuclei safe templates
  ↓
OpenHack Hunter Workflow
  ↓
Strix Reasoning / Mini Summary / Full Reasoning tùy gói
  ↓
Evidence sanitizer
  ↓
Findings + Report
  ↓
Manual Retest
```

## 7.2. Free pipeline

```text
Verify domain
→ Playwright lightweight observation
→ ZAP passive mini
→ Nuclei mini safe
→ OpenHack mini hunters
→ Strix Mini Summary
→ Hunter Snapshot Report
```

## 7.3. Standard/Auth pipeline

```text
Verify domain
→ Scope authorization
→ Optional test accounts
→ Browser Inspector sâu hơn
→ ZAP passive/baseline
→ Nuclei safe standard profile
→ OpenHack workflow chooses expert manifests
→ Strix attacker-mindset reasoning
→ safe validation proposal
→ User Approval Gate nếu cần
→ finding/report/retest plan
```

---

# 8. Cost optimization

## 8.1. Không đưa raw data vào LLM

Không làm:

```text
raw HAR + full DOM + full JS bundle + full logs → Strix
```

Làm:

```text
raw evidence → deterministic summarizer → compact security context → Strix
```

## 8.2. Các giới hạn nội bộ

Không show trên pricing, nhưng cần trong hệ thống:

```text
- max runtime
- max routes
- max network requests
- max JS bundles
- max tool actions
- max validation attempts
- max raw evidence size
- max LLM context size
- max retest runs
```

## 8.3. Không bán hypothesis budget

Không ghi với user:

```text
Gói này có 10 hypotheses.
```

Nội bộ có thể có budget, nhưng pricing bán theo:

```text
- coverage
- evidence
- retest
- expert review
- authenticated context
```

## 8.4. Model/tool strategy

```text
Rule first
Browser first
Summarize before LLM
OpenHack structure before Strix
Strix only on compact context
Retest narrow
Cache previous observations
```

---

# 9. Packages v1

## 9.1. Free — Vibe-code Hunter Snapshot

Mục tiêu:

```text
Cho user thấy chất hunter, kéo lead, không tốn full Strix.
```

Bao gồm:

```text
- domain verification
- lightweight browser inspect
- mini exposure hunter
- frontend secret/storage hunter
- API surface hunter
- auth/session smoke hunter
- AI app smoke hunter nếu phát hiện chatbot
- ZAP passive mini
- Nuclei mini safe
- Strix Mini Summary
- Snapshot score
- coverage report
- what we could not test
```

Không bao gồm:

```text
- full Strix adversarial reasoning
- authenticated scan
- multi-account access test
- deep business logic testing
- expert human review
- CI/CD
```

Retest:

```text
- 1 simple auto retest cho lỗi cấu hình/exposure đơn giản
```

## 9.2. Light — Fast Vibe-code Security Check

Mục tiêu:

```text
Gói rẻ có thể bán, sâu hơn Free nhưng chưa phải full pentest.
```

Bao gồm:

```text
- toàn bộ Free
- browser inspect nhiều route hơn
- API surface summary đầy đủ hơn
- OpenHack mini hunters đầy đủ hơn
- Strix limited reasoning trên top suspicious surfaces
- Human report
- AI fix prompt cho từng finding
- Finding board cơ bản
```

Retest:

```text
- vài retest đơn giản
- User Approval Gate nếu action nhạy cảm
```

## 9.3. Standard — AI White-hat Check

Mục tiêu:

```text
Gói chính cho startup chuẩn bị launch.
```

Bao gồm:

```text
- toàn bộ Light
- Strix attacker-mindset reasoning trong verified scope
- OpenHack workflow/schema/report structure
- ZAP/Nuclei standard-safe signals
- prioritized findings
- business impact
- AI-readable technical report
- manual retest từng finding
- User Approval Gate cho validation nhạy cảm
```

Retest:

```text
- manual retest theo từng finding
- auto retest cho deterministic issues
- AI-assisted retest cho issues cần ngữ cảnh
```

Expert review:

```text
- Add-on, không mặc định
```

## 9.4. Auth — Access Control Check

Mục tiêu:

```text
Gói giá trị cao nhất trong v1, tập trung lỗi sau đăng nhập.
```

Yêu cầu:

```text
- ít nhất 1 test account
- tốt nhất 2 test accounts: User A/User B
```

Bao gồm:

```text
- toàn bộ Standard
- authenticated browser inspect
- session/cookie/token checks
- role boundary checks nếu có role
- User A/User B access-control checks nếu có 2 accounts
- BOLA/IDOR suspicion and safe validation
- private data exposure checks
- admin-like endpoint visibility
```

Retest:

```text
- manual retest
- User Approval Gate bắt buộc cho access-control retest
```

Expert review:

```text
- optional add-on cho High/Critical
```

## 9.5. Launch Audit

Mục tiêu:

```text
Gói cao cấp, không phải instant scan. Dùng trước launch, demo khách B2B, gọi vốn.
```

Bao gồm:

```text
- Standard/Auth tùy scope
- expert human review thật nếu có người review
- report được kiểm tra trước khi gửi ra ngoài
- final readiness summary
- retest sau khi fix theo phạm vi
```

Không bán nếu chưa có người review thật.

---

# 10. Monitor / monthly plans

## 10.1. Monthly không phải CI/CD auto retest

Gói tháng dùng để giữ chân qua:

```text
- findings workspace
- report history
- retest quota
- reminders
- regression status thủ công
- security score trend
```

Không làm trong v1:

```text
- tự động chạy sau mỗi deploy
- GitHub Actions
- Vercel webhook
- CI/CD integration
```

## 10.2. Monitor Lite

Bao gồm:

```text
- 1 project/domain
- lưu report
- finding board
- retest quota nhỏ
- reminders
```

## 10.3. Monitor Startup

Bao gồm:

```text
- nhiều project/domain hơn
- report history dài hơn
- retest quota lớn hơn
- status workflow
- risk acceptance
- monthly summary thủ công/tự động nhẹ
```

## 10.4. Monitor Pro

Bao gồm:

```text
- team workspace cơ bản
- nhiều domain hơn
- authenticated findings tracking
- priority retest queue
- expert review add-on nếu có
```

---

# 11. Retest design

## 11.1. Retest là manual trong v1

Không có CI/CD auto retest.

Flow:

```text
User/dev sửa lỗi
→ user mark Ready for Retest
→ user bấm Retest this finding
→ nếu action nhạy cảm, User Approval Gate hiện ra
→ hệ thống chạy scenario hẹp
→ cập nhật kết quả
```

## 11.2. Retest types

### Auto Retest

Cho deterministic issues:

```text
- missing header
- cookie flag
- public sourcemap
- exposed debug route
- basic CORS
```

### AI-assisted Retest

Cho issues cần ngữ cảnh:

```text
- API behavior
- session issue
- excessive data exposure
- suspicious access-control issue
```

### Expert-reviewed Retest

Không mặc định. Chỉ nếu có người review thật hoặc add-on:

```text
- High/Critical
- access-control
- private data
- billing/payment
- ambiguous result
```

---

# 12. Report system

## 12.1. Luôn có 2 loại report từ Light trở lên

```text
1. Human-readable report
2. AI/dev-readable technical report
```

Free có bản rút gọn:

```text
Hunter Snapshot Report
```

## 12.2. Human-readable report

Dành cho founder/PM/client.

Gồm:

```text
- summary
- score
- top risks
- findings/warnings/hardening
- business impact
- priority fix plan
- what we could not test
- recommended next step
```

## 12.3. AI/dev-readable report

Dành cho dev/AI coding agent.

Gồm:

```text
- finding id
- affected asset
- severity/confidence
- sanitized evidence
- expected behavior
- current observed behavior
- fix prompt
- retest scenario
- acceptance criteria
```

Không chứa:

```text
- raw password
- raw token/cookie
- raw secrets
- full destructive payload
- customer private data
```

---

# 13. Finding board

## 13.1. States v1

```text
Open
In Progress
Ready for Retest
Fixed
Still Vulnerable
Accepted Risk
```

Không cần Jira-like workflow.

## 13.2. Mỗi finding có

```text
- title
- severity
- confidence
- status
- short explanation
- technical detail
- sanitized evidence
- fix suggestion
- copy AI fix prompt
- retest button
- activity log cơ bản
```

---

# 14. UI progress

Không show công nghệ lõi. Show milestone:

```text
Đang xác minh phạm vi kiểm thử
Đang mở website bằng browser thật
Đang quan sát request/API được frontend gọi
Đang kiểm tra cấu hình bảo mật phổ biến
Đang chạy Hunter Snapshot
Đang phân tích các bề mặt rủi ro đáng chú ý
Đang tạo report
```

Với Standard/Auth có thể show:

```text
AI đang mô phỏng tư duy attacker trong phạm vi đã xác minh
Đang kiểm tra các luồng nhạy cảm
Đang xác minh các phát hiện quan trọng
```

Không show:

```text
- prompt nội bộ
- payload cụ thể
- tool chain chi tiết
- raw request/response chứa secret
```

---

# 15. Data model tối giản v1

```text
organizations
users
projects
domains
domain_verifications
scan_authorizations
test_accounts
scan_jobs
scan_steps
evidence_items
finding_candidates
findings
reports
retest_runs
credit_ledger
audit_logs
```

Không cần:

```text
github_repositories
jira_integrations
deploy_webhooks
ci_runs
cloud_accounts
vps_agents
```

---

# 16. API tối giản v1

```text
POST /projects
POST /projects/:id/domains
POST /domains/:id/verify/dns
POST /domains/:id/verify/file
POST /projects/:id/scan-authorizations
POST /projects/:id/test-accounts
POST /projects/:id/scans
GET  /scans/:id
GET  /scans/:id/progress
GET  /projects/:id/findings
GET  /findings/:id
POST /findings/:id/status
POST /findings/:id/retest
GET  /reports/:id
```

---

# 17. Roadmap v1

## Week 1 — Product skeleton

```text
- SaaS web skeleton
- auth/org/project
- domain verification DNS TXT + well-known
- scan authorization model
- finding schema
- report schema
```

## Week 2 — Free Hunter Snapshot

```text
- Playwright lightweight browser inspector
- Nuclei mini safe profile
- ZAP passive mini
- OpenHack-style mini hunter workflow
- Strix Mini Summary
- Free Hunter Snapshot Report
```

## Week 3 — Light/Standard scan

```text
- deeper browser inspector
- normalizer/evidence sanitizer
- Strix attacker-mindset core integration
- OpenHack schema/report workflow
- finding board
- human report
- AI/dev report
```

## Week 4 — Retest + packages

```text
- manual retest per finding
- User Approval Gate
- auto retest deterministic issues
- AI-assisted retest for selected issues
- credit/package logic
- pricing gate
```

## Week 5–6 — Auth check

```text
- credential vault
- login flow
- session/cookie/token checks
- User A/User B support
- access-control/BOLA/IDOR safe checks
- Auth report
```

---

# 18. Final chốt

## V1 cần build

```text
- Strix core
- OpenHack Free Hunter/workflow layer
- Playwright Browser Inspector
- ZAP passive/baseline signal
- Nuclei curated safe signal
- SaaS core
- Domain verification
- User Approval Gate
- Reports
- Finding board
- Manual retest
```

## V1 không build

```text
- GitHub
- Jira/Linear
- CI/CD auto retest
- VPS/cloud verification
- mobile APK hunter
- SAST/SCA/secrets
- DefectDojo production
- secureCodeBox/K8s
```

## Câu chốt cho team

```text
V1 không phải scanner thường và cũng không phải DevSecOps platform.

Strix là lõi attacker-mindset.
OpenHack tạo Free Hunter workflow để gói Free vẫn có chất săn lỗi mà không chạy full Strix.
Playwright giúp nhìn app thật.
ZAP/Nuclei tạo tín hiệu nhanh/rẻ.
SaaS core biến mọi thứ thành sản phẩm: verify, report, finding board, retest, billing.

Không làm CI/CD, GitHub, Jira, VPS/cloud trong v1.
Retest là manual theo từng finding.
Human review chỉ gọi là Expert Human Review nếu thật sự có chuyên gia review; còn user bấm approve là User Approval Gate.
```
