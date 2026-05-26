# ACCEPTANCE_CRITERIA.md — AI White-hat Security Workspace

> Tài liệu định nghĩa điều kiện “làm xong đúng” cho từng nhóm feature.  
> Nếu chưa đạt các tiêu chí này, không xem là production-ready.

---

# 1. Global acceptance criteria

V1 được xem là đạt tối thiểu khi:

```text
- User verify domain bằng DNS TXT hoặc /.well-known file.
- Domain chưa verified thì không scan được.
- User tạo scan authorization trước khi scan.
- Free Hunter Snapshot chạy được và trả report có giá trị.
- Light/Standard/Auth tạo findings và reports đúng format.
- Finding board hoạt động.
- Manual retest từng finding hoạt động.
- User Approval Gate xuất hiện cho action nhạy cảm.
- Không lộ raw password/token/cookie/API key trong logs/report/LLM prompt.
```

---

# 2. Domain verification

## 2.1. DNS TXT verification

Đạt khi:

```text
- Hệ thống sinh token.
- UI hướng dẫn user thêm TXT record.
- Backend kiểm tra TXT record đúng token.
- Nếu đúng token, domain status = verified.
- Nếu sai/không có record, status vẫn pending/failed.
- Verified domain có verified_at.
- Expired verification không cho scan.
```

## 2.2. /.well-known file verification

Đạt khi:

```text
- Hệ thống sinh token.
- UI hướng dẫn user tạo file.
- Backend GET đúng path.
- Nội dung file khớp token thì verified.
- Chỉ hostname tương ứng được verify.
```

## 2.3. Blocking

Đạt khi:

```text
- Domain chưa verified không tạo được scan job.
- Private/local IP bị reject.
- Metadata endpoint bị reject.
- URL có userinfo/trick parsing bị reject hoặc normalize an toàn.
- Redirect ngoài scope bị block.
```

---

# 3. Scan authorization & scope

Đạt khi:

```text
- User phải tạo scan authorization trước khi scan.
- Authorization lưu allowed_hosts, excluded_paths, package, consent.
- Scan chỉ chạy trên allowed_hosts.
- Excluded paths không bị scan/retest.
- Mọi scan job có authorization_id.
- Authorization snapshot được lưu cho audit.
```

---

# 4. Test account

Đạt khi:

```text
- User thêm test account với login_url thuộc verified scope.
- Password/credential được mã hóa.
- Raw credential không xuất hiện trong DB field plain text.
- Raw credential không xuất hiện trong logs.
- Raw credential không xuất hiện trong report.
- Raw credential không được đưa vào LLM/Strix prompt.
- User xóa được test account.
```

---

# 5. Browser Inspector

Đạt khi:

```text
- Worker mở browser context riêng cho mỗi scan.
- Worker capture network metadata.
- Worker capture API endpoints.
- Worker capture console errors.
- Worker capture cookie attributes.
- Worker capture storage key names/token-like indicators.
- Worker không navigate ngoài scope.
- Worker có timeout.
- Worker output evidence đã sanitize hoặc có raw evidence được khóa riêng.
```

Free mode đạt khi:

```text
- Chạy lightweight observation.
- Không cần test account.
- Trả attack surface summary.
```

Auth mode đạt khi:

```text
- Có thể login bằng test account.
- Capture authenticated context.
- Không leak credential.
```

---

# 6. ZAP Signal Worker

Đạt khi:

```text
- Free chạy passive mini hoặc equivalent safe mode.
- Light/Standard/Auth chạy baseline/passive theo scope.
- Worker có timeout.
- Worker không chạy full active scan mặc định.
- Output được normalize thành FindingCandidate.
- Scan fail thì ghi lỗi rõ, không fake success.
```

---

# 7. Nuclei Signal Worker

Đạt khi:

```text
- Chỉ chạy curated safe templates.
- Không chạy destructive/intrusive/bruteforce/dos templates.
- Có timeout/rate limit.
- Free dùng mini profile.
- Light/Standard/Auth dùng standard-safe profile.
- Output được normalize thành FindingCandidate.
```

---

# 8. OpenHack-style Hunter Workflow

Đạt khi Free report có output từ các mini hunter:

```text
- Vibe-code Exposure Hunter.
- Frontend Secret & Storage Hunter.
- API Surface Hunter.
- Auth/Session Smoke Hunter.
- AI App Smoke Hunter nếu phát hiện chatbot/LLM.
```

Mỗi hunter output được phân loại thành:

```text
- Finding
- Warning
- Hardening
- CoverageGap
```

Không đạt nếu Free chỉ trả header/cookie scan đơn giản mà không có Hunter Snapshot structure.

---

# 9. Strix Core

## 9.1. Free

Đạt khi:

```text
- Free chỉ dùng Strix Mini Summary.
- Strix đọc compact context, không đọc raw secret.
- Output có top observations và next steps.
```

## 9.2. Standard/Auth

Đạt khi:

```text
- Strix tạo attacker-mindset analysis trong verified scope.
- Strix output findings hoặc suspicious risk areas.
- Strix đề xuất remediation/fix prompt.
- Strix không tự chạy action nhạy cảm nếu chưa qua Product Policy Gate.
```

Không đạt nếu:

```text
- Strix được phép scan ngoài scope.
- Strix nhận raw credential.
- Strix tạo destructive action mà không cần approval.
```

---

# 10. Reports

## 10.1. Free Hunter Snapshot Report

Đạt khi report có:

```text
- Snapshot score.
- Top observations.
- Findings/warnings/hardening.
- Public attack surface summary.
- What we could not test.
- Recommended next step.
```

Nếu không có lỗi nghiêm trọng, report phải ghi:

```text
Không phát hiện Critical/High trong phạm vi snapshot hiện tại.
```

Không được ghi:

```text
Không có lỗi.
100% secure.
```

## 10.2. Human-readable report

Đạt khi có:

```text
- Executive summary.
- Scope tested.
- Top risks.
- Severity.
- Business impact.
- Priority fix plan.
- Limitations.
```

## 10.3. AI/dev-readable report

Đạt khi có:

```text
- finding_id
- affected_asset
- severity/confidence
- sanitized_evidence
- expected_behavior
- observed_behavior
- fix_prompt
- retest_scenario
- acceptance_criteria
```

---

# 11. Finding Board

Đạt khi:

```text
- User xem được danh sách findings.
- User xem được detail từng finding.
- User đổi trạng thái In Progress / Ready for Retest / Accepted Risk.
- Finding có severity/confidence/status.
- Finding có sanitized evidence.
- Finding có fix suggestion.
- Finding có copy AI fix prompt.
- Finding có retest button nếu supported.
```

---

# 12. Manual Retest

Đạt khi:

```text
- Retest gắn với finding_id cụ thể.
- Retest không scan lại toàn bộ app.
- Retest kiểm tra scope trước khi chạy.
- Retest có timeout.
- Retest ghi audit log.
- Retest cập nhật trạng thái finding.
```

Kết quả hợp lệ:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

Không đạt nếu:

```text
- Retest chạy ngoài scope.
- Retest tự động chạy sau deploy.
- Retest không gắn với finding.
```

---

# 13. User Approval Gate

Đạt khi approval hiển thị trước action nhạy cảm:

```text
- action cần chạy
- domain/path liên quan
- account dùng nếu có
- rủi ro
- điều sẽ không thực hiện
- nút approve/cancel
```

Nếu user cancel:

```text
- action không chạy
- audit log ghi denied
```

---

# 14. Security guardrails

Đạt khi các test sau pass:

```text
- cannot scan unverified domain
- cannot scan private IP
- cannot follow out-of-scope redirect
- cannot create scan without authorization
- cannot include raw secret in report
- cannot include raw secret in LLM prompt
- cannot retest outside finding scope
```

---

# 15. Performance acceptance

Mục tiêu:

```text
- Free Snapshot: 3–10 phút.
- Light: 10–25 phút.
- Standard: 20–60 phút.
- Auth: 45–120 phút.
- Simple retest: dưới 1 phút.
```

Nếu timeout:

```text
- scan không được treo vô hạn
- report ghi rõ partial/timeout nếu cần
- user thấy trạng thái rõ ràng
```

---

# 16. Production readiness blocker

Không được coi là production-ready nếu còn bất kỳ lỗi nào:

```text
- scan domain chưa verified
- private/local IP scan được
- raw secret lộ trong log/report/prompt
- worker không timeout
- report dùng mock data trong production
- retest chạy ngoài scope
- Strix action nhạy cảm không qua policy/approval
- Free report không có giá trị khi không tìm thấy lỗi
```

---

# 17. LLM Provider Layer acceptance

Đạt khi:

```text
- Có LLM Gateway chung cho OpenAI / Claude / DeepSeek.
- Business logic không gọi trực tiếp provider SDK.
- Provider được chọn qua model alias/config.
- Prompt Sanitizer chạy trước mọi provider call.
- Budget theo package hoạt động.
- Timeout/retry/fallback hoạt động.
- Token/cost/latency được log bằng metadata an toàn.
- Raw password/token/cookie/API key không xuất hiện trong prompt/log/report.
- Khi provider chính lỗi, fallback hoặc graceful failure hoạt động.
```

Không đạt nếu:

```text
- Có provider SDK call rải rác ngoài adapter.
- API key hardcode trong code.
- Raw secret đi vào prompt.
- LLM call không có timeout.
- Vượt budget nhưng hệ thống vẫn gọi tiếp không kiểm soát.
```
