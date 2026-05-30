# AGENTS.md — AI Coding Agent Rules

> File này là luật làm việc cho AI coding agents trong repo.  
> Mục tiêu: giúp agent triển khai đúng scope v1, không tự mở rộng sản phẩm, không tạo feature ngoài kế hoạch, không vi phạm guardrails bảo mật.

---

# 1. Tài liệu phải đọc trước khi code

Trước khi implement bất kỳ task nào, agent phải đọc theo thứ tự:

```text
1. PRD.md
2. ARCHITECTURE.md
3. SECURITY_GUARDRAILS.md
4. ACCEPTANCE_CRITERIA.md
5. WORKER_SPEC.md
6. LLM_PROVIDER_SPEC.md
7. PRODUCTION_READINESS.md
```

Nếu nội dung các file mâu thuẫn nhau, ưu tiên theo thứ tự:

```text
SECURITY_GUARDRAILS.md
→ ACCEPTANCE_CRITERIA.md
→ PRD.md
→ ARCHITECTURE.md
→ WORKER_SPEC.md
→ LLM_PROVIDER_SPEC.md
→ PRODUCTION_READINESS.md
```

---

# 2. Scope v1 bắt buộc tuân thủ

V1 chỉ làm:

```text
Authorized external web/app security testing cho domain đã xác minh.
```

Cụ thể:

```text
- Domain verification.
- Scope authorization.
- Optional test account.
- Browser Inspector bằng Playwright/CDP.
- ZAP passive/baseline signal.
- Nuclei curated safe templates.
- OpenHack-style Free Hunter workflow.
- Strix attacker-mindset reasoning.
- Human-readable report.
- AI/dev-readable report.
- Finding board.
- Manual retest từng finding.
- User Approval Gate cho action nhạy cảm.
```

Agent không được đổi “black-hat mindset” thành “white-hat audit”, “compliance scan” hoặc checklist scanner.

Đúng intent:
- authorized black-hat mindset simulation;
- hypothesis-driven testing;
- abuse-path reasoning;
- controlled execution inside verified scope.

Sai intent:
- generic defensive audit;
- compliance-only report;
- scanner-only checklist;
- uncontrolled offensive tool.

Không tự thêm các phần sau nếu chưa có yêu cầu rõ:

```text
- GitHub repo access.
- Jira / Linear integration.
- CI/CD-based automated retesting.
- Deployment-triggered retest.
- VPS / instance verification.
- Cloud account verification.
- Private network scan.
- Server agent.
- SAST / SCA / secrets scanning.
- Mobile APK audit.
- DefectDojo production integration.
- secureCodeBox / Kubernetes orchestration phức tạp.
```

---

# 3. Nguyên tắc không tự mở rộng sản phẩm

Agent không được tự thêm feature lớn chỉ vì “có vẻ hợp lý”.

Không được tự ý thêm:

```text
- Integration mới.
- Worker mới ngoài plan.
- OAuth provider mới.
- Billing model mới.
- Report format mới ngoài yêu cầu.
- Scan mode mới.
- Admin/enterprise feature ngoài scope.
```

Nếu phát hiện một feature có vẻ cần thiết nhưng chưa có trong tài liệu, hãy ghi:

```text
TODO: cần owner xác nhận trước khi triển khai.
```

Không tự implement.

---

# 4. Quy tắc bảo mật bắt buộc

## 4.1. Domain và scope

Không được tạo scan job nếu:

```text
- Domain chưa verified.
- Verification đã expired.
- User chưa tạo scan authorization.
- Target nằm ngoài allowed_hosts.
- URL redirect ra ngoài scope.
- Target là private/local/metadata IP.
```

## 4.2. Secret và credential

Không được:

```text
- Log raw password.
- Log raw token.
- Log raw cookie.
- Log raw API key.
- Ghi raw credential vào report.
- Đưa raw credential vào LLM prompt.
- Lưu credential dạng plain text.
```

Credential phải được mã hóa.

## 4.3. AI / Strix

Strix được dùng để suy luận attacker-mindset, nhưng mọi action nhạy cảm phải qua Product Policy Gate.

Không được để Strix:

```text
- Scan ngoài scope.
- Tự ý gọi destructive endpoint.
- Tự ý dùng credential raw.
- Tự ý tạo exploit hướng dẫn lạm dụng.
- Tự ý vượt runtime/tool/token budget.
```

## 4.4. Retest

Retest trong v1 là manual.

Không được implement:

```text
- CI/CD-based automated retesting.
- Deployment-triggered retest.
- Background retest sau mỗi deploy.
```

Retest phải:

```text
- Gắn với một finding cụ thể.
- Chạy scenario hẹp.
- Kiểm tra scope trước khi chạy.
- Có User Approval Gate nếu action nhạy cảm.
```

---

# 5. Quy tắc worker

Mọi worker phải có:

```text
- timeout
- retry limit
- structured logs
- scan_id
- project_id
- worker_type
- error handling
- audit event nếu action quan trọng
```

Worker không được chạy vô hạn.

Worker không được silently fail.

Worker không được ghi fake success khi tool thật fail.

---

# 6. Quy tắc evidence và report

Mọi evidence đưa vào report phải qua sanitizer.

Report không được chứa:

```text
- raw password
- raw cookie
- raw token
- raw API key
- PII chưa được sanitize
- raw request/response nhạy cảm
```

Nếu không phát hiện lỗi nghiêm trọng, không ghi:

```text
Không phát hiện lỗi.
```

Phải ghi rõ:

```text
Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại.
```

Và kèm:

```text
- đã kiểm tra gì
- coverage
- giới hạn kiểm thử
- phần chưa kiểm tra được
- bước tiếp theo
```

---

# 7. Quy tắc Free Hunter

Free Hunter không phải bản engine yếu.

Free phải:
- dùng browser/ZAP/Nuclei/OpenHack pipeline chất lượng cao ở mức giới hạn;
- dùng DeepSeek V4 Flash cho triage/ranking;
- dùng DeepSeek V4 Pro cho first valuable finding reasoning;
- dừng sau 1 valuable finding;
- tạo report đầy đủ cho finding đó;
- chỉ monitor 1 finding;
- chỉ cho 1 retest;
- áp dụng cooldown 7 ngày để tìm finding mới nếu user không nâng gói.

Free không được:
- mở full paid finding board;
- trả nhiều findings;
- monitor nhiều findings;
- chạy full paid adversarial depth;
- chạy multi-account Authenticated Scope.

---

# 8. Quy tắc code và test

Mỗi feature quan trọng phải có test phù hợp.

Bắt buộc có test cho:

```text
- Domain verification.
- Scope validation.
- Private/local IP blocking.
- Redirect out-of-scope blocking.
- Credential encryption.
- Evidence sanitizer.
- Scan job creation policy.
- Retest policy.
- Report sanitizer.
```

Không merge code nếu:

```text
- Test quan trọng fail.
- Security guardrail bị bypass.
- Có raw secret trong logs/report.
- Scan được domain chưa verify.
```

---

# 9. Quy tắc mock/demo

Được dùng mock trong:

```text
- local development
- demo environment
- UI prototype
```

Nhưng phải ghi rõ:

```text
MOCK / DEMO DATA
```

Không được để mock scan result đi vào production path.

Không được làm UI khiến user tưởng scan thật nếu backend đang trả mock.

---

# 10. Quy tắc khi không chắc

Nếu agent không chắc yêu cầu, phải dừng và hỏi.

Không tự quyết các vấn đề sau:

```text
- Thêm integration mới.
- Đổi core architecture.
- Đổi scope v1.
- Đổi pricing/package logic.
- Bật destructive/active scan sâu.
- Cho phép scan private/internal target.
- Cho phép CI/CD-based automated retesting.
```

Câu hỏi nên ghi rõ:

```text
Cần xác nhận: [vấn đề]  
Các lựa chọn: [A/B/C]  
Khuyến nghị: [phương án đề xuất]
```

---

# 11. Done checklist cho mọi PR/task

Trước khi kết thúc task, agent phải tự kiểm tra:

```text
- Có đúng scope v1 không?
- Có vi phạm SECURITY_GUARDRAILS.md không?
- Có test cho logic quan trọng không?
- Có log/audit phù hợp không?
- Có xử lý lỗi không?
- Có timeout/retry nếu là worker không?
- Có sanitize evidence/report không?
- Có lộ secret không?
- Có fake production result không?
- Có cập nhật tài liệu liên quan nếu thay đổi behavior không?
```

Nếu câu trả lời cho bất kỳ mục nào là “không chắc”, phải ghi rõ trong summary.

---

# 12. Quy tắc LLM Provider

Agent phải tuân thủ:

```text
- Không gọi trực tiếp DeepSeek SDK trong business logic.
- Mọi LLM call phải đi qua LLM Gateway.
- V1 production path dùng DeepSeek-first:
  - DeepSeek V4 Flash = triage/ranking.
  - DeepSeek V4 Pro = reasoning supervisor/report/fix/retest.
- OpenAI/Claude không phải default v1; chỉ thêm nếu Enterprise/PAYG escalation được owner xác nhận.
- Không hardcode model cụ thể trong code nghiệp vụ.
- Chỉ dùng model alias từ config.
- Không đưa raw credential/secret/raw evidence vào prompt.
- Không log raw prompt nếu có dữ liệu nhạy cảm.
- Nếu cần provider/model mới, tạo adapter/config, không sửa rải rác nhiều service.
```

Khi implement tính năng dùng LLM, phải kiểm tra:

```text
- use_case đã được định nghĩa trong LLM_PROVIDER_SPEC.md chưa?
- package budget có cho phép không?
- prompt đã sanitize chưa?
- fallback/timeout/retry đã có chưa?
- output đã normalize chưa?
```
