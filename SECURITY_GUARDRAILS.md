# SECURITY_GUARDRAILS.md — AI White-hat Security Workspace

> Tài liệu này định nghĩa các ràng buộc an toàn bắt buộc cho v1.  
> Mọi implementation, worker, AI agent, report, retest và scan job phải tuân thủ tài liệu này.

---

# 1. Nguyên tắc tối cao

## 1.1. Không xác minh thì không kiểm thử

```text
No verified ownership / authorization → no scan.
```

Hệ thống không được tạo scan job nếu:

```text
- Domain chưa được xác minh.
- Verification đã hết hạn.
- User chưa tạo scan authorization.
- Target nằm ngoài allowed scope.
- Target là private/local/metadata IP.
```

## 1.2. Chỉ kiểm thử trong phạm vi được ủy quyền

Mọi request, browser action, scanner action, Strix action, OpenHack workflow và retest scenario phải nằm trong:

```text
- verified domain / hostname
- allowed hosts
- allowed paths
- scan authorization
- scan package permission
```

## 1.3. Strix được suy luận tự do, nhưng hành động phải được kiểm soát

Strix được dùng để mô phỏng attacker-mindset, tạo giả thuyết và phân tích rủi ro.  
Tuy nhiên, mọi hành động nhạy cảm phải đi qua Product Policy Gate.

```text
Free reasoning, governed execution.
```

---

# 2. Domain, URL và scope guardrails

## 2.1. Domain verification bắt buộc

V1 hỗ trợ:

```text
- DNS TXT verification
- /.well-known file verification
```

Không tạo scan job nếu domain chưa verified.

## 2.2. URL normalization bắt buộc

Trước khi scan, hệ thống phải normalize URL:

```text
- chuẩn hóa scheme
- chuẩn hóa hostname
- loại bỏ userinfo trong URL
- loại bỏ fragment
- resolve redirect nếu cần
- kiểm tra hostname thuộc allowed scope
```

## 2.3. Chặn target nguy hiểm

Không được scan:

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

Nếu target redirect ra ngoài allowed scope:

```text
- chặn scan
- ghi audit log
- hiển thị lỗi rõ ràng cho user
```

Không follow redirect ngoài scope.

---

# 3. Scan authorization guardrails

## 3.1. Scan authorization bắt buộc

Mỗi scan phải có bản ghi authorization gồm:

```text
- project_id
- user_id
- verified_domain_id
- scan_package
- allowed_hosts
- excluded_paths
- test_account_permission
- sensitive_action_permission
- created_at
- expires_at nếu có
```

## 3.2. Scope snapshot

Trước khi scan, hệ thống phải lưu snapshot cấu hình:

```text
- domain verification status
- allowed hosts
- excluded paths
- scan package
- test accounts được phép dùng
- user approval decisions
```

Scan/retest phải dùng snapshot này để audit.

---

# 4. Credential và secret guardrails

## 4.1. Không lưu plain text

Không được lưu plain text:

```text
- password
- token
- cookie
- API key
- session secret
```

Credential phải được mã hóa.

## 4.2. Không log secrets

Không được log:

```text
- raw password
- raw token
- raw cookie
- raw API key
- full Authorization header
- raw session value
```

## 4.3. Không đưa secrets vào LLM prompt

Không được đưa vào Strix/OpenHack/LLM:

```text
- raw password
- raw cookie
- raw token
- raw API key
- raw private data
```

Chỉ được đưa summary đã sanitize.

## 4.4. Test account

Test account chỉ được dùng khi:

```text
- login URL thuộc verified scope
- user đã consent dùng test account
- credential được mã hóa
- worker dùng credential qua vault/session abstraction
```

---

# 5. Worker guardrails

## 5.1. Mọi worker phải có giới hạn

Bắt buộc có:

```text
- timeout
- retry limit
- rate limit
- max requests
- max evidence size
- structured logs
- scan_id
- project_id
- worker_type
```

Worker không được chạy vô hạn.

## 5.2. Không fake kết quả

Không được:

```text
- trả success giả khi scanner fail
- tạo finding giả để UI có dữ liệu
- dùng mock result trong production path
```

Mock chỉ dùng ở local/demo và phải gắn nhãn rõ.

## 5.3. ZAP guardrails

V1 chỉ dùng:

```text
- passive scan
- baseline scan
- selected safe checks nếu được cấu hình rõ
```

Không dùng full active scan mặc định.

## 5.4. Nuclei guardrails

Chỉ dùng curated safe templates.

Không chạy template có tính chất:

```text
- destructive
- intrusive
- brute-force
- DoS
- malware
- credential attack
```

## 5.5. Playwright/CDP guardrails

Browser Inspector phải:

```text
- dùng browser context riêng cho mỗi scan/account
- không persist raw credential
- chỉ lưu evidence đã kiểm soát
- chặn navigation ra ngoài scope
- không tự click action destructive nếu chưa có approval
```

---

# 6. Strix và OpenHack guardrails

## 6.1. Strix

Strix được phép:

```text
- đọc compact security context đã sanitize
- tạo giả thuyết rủi ro
- đề xuất validation action
- phân loại severity/confidence
- đề xuất remediation
- tạo retest plan
```

Strix không được:

```text
- scan ngoài scope
- tự chạy destructive action
- tự gọi endpoint nhạy cảm khi chưa có approval
- nhận raw secrets
- xuất hướng dẫn lạm dụng
```

## 6.2. OpenHack workflow

OpenHack-style workflow dùng để:

```text
- expert manifest
- mini hunter task
- schema hóa finding/warning/hardening/coverage gap
- hỗ trợ report và review package
```

Không dùng OpenHack để tự mở rộng scope scan.

---

# 7. User Approval Gate

## 7.1. Khi nào cần approval?

Bắt buộc yêu cầu user approval nếu action:

```text
- dùng test account
- kiểm tra access-control
- gọi POST/PUT/PATCH/DELETE
- liên quan billing/payment
- liên quan file upload/delete/export
- liên quan email/webhook
- retest finding High/Critical
- có thể làm thay đổi dữ liệu
```

## 7.2. Nội dung approval phải hiển thị

User phải thấy:

```text
- finding/action cần chạy
- domain/host/path liên quan
- account nào được dùng
- action nào sẽ thực hiện
- action nào sẽ không thực hiện
- rủi ro còn lại
```

---

# 8. Retest guardrails

## 8.1. Retest là manual trong v1

Không implement:

```text
- CI/CD auto retest
- deploy-triggered retest
- background retest sau deploy
```

## 8.2. Retest phải hẹp

Mỗi retest phải gắn với một finding cụ thể:

```text
- finding_id
- scenario_id
- allowed target
- expected result
- max runtime
```

Không retest bằng cách scan lại toàn bộ app.

## 8.3. Retest result

Kết quả hợp lệ:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

Không kết luận “Fixed” nếu evidence không đủ.

---

# 9. Evidence và report guardrails

## 9.1. Evidence sanitizer bắt buộc

Mọi evidence đưa vào report phải qua sanitizer.

Phải mask:

```text
- password
- token
- cookie
- API key
- Authorization header
- session id
- private user data
```

## 9.2. Report wording

Không ghi:

```text
Website an toàn tuyệt đối.
Không có lỗi.
100% secure.
```

Ghi:

```text
Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại.
```

Và nêu rõ:

```text
- scope đã kiểm thử
- coverage
- limitation
- phần chưa kiểm tra được
```

---

# 10. Production block conditions

Không được release nếu còn lỗi sau:

```text
- scan được domain chưa verified
- scan được private/local IP
- redirect ra ngoài scope vẫn bị follow
- raw credential xuất hiện trong log/report/prompt
- Strix nhận raw secret
- retest chạy ngoài finding scope
- production trả mock result
- worker không có timeout
- report không sanitize evidence
```

---

# 11. Audit log bắt buộc

Phải ghi audit log cho:

```text
- domain verification created
- domain verification success/fail
- scan authorization created
- scan started/completed/failed
- test account added/deleted
- user approval accepted/denied
- retest started/completed
- report generated
- finding status changed
```

---

# 12. LLM Provider Guardrails

## 12.1. LLM Gateway bắt buộc

Mọi request tới OpenAI / Claude / DeepSeek phải đi qua `LLM Gateway`.

Không được gọi trực tiếp provider SDK trong business logic, workers hoặc report service.

## 12.2. Prompt Sanitizer bắt buộc

Trước mọi LLM call phải chạy sanitizer.

Không được đưa vào provider:

```text
- raw password
- raw token
- raw cookie
- raw API key
- Authorization header
- session id
- private user data chưa sanitize
```

## 12.3. Budget và fallback

Mọi LLM call phải có:

```text
- use_case
- package_tier
- max input/output token
- timeout
- retry limit
- fallback policy
```

## 12.4. Logging an toàn

Được log:

```text
- provider
- model_alias
- latency
- token usage
- estimated cost
- error code
```

Không được log raw prompt nếu prompt có dữ liệu nhạy cảm.
