# PRD.md — AI White-hat Security Workspace

> PRD này chỉ mô tả **feature, user flow, gói dịch vụ, trải nghiệm người dùng và giá trị sản phẩm**.  
> Không mô tả chi tiết kiến trúc, worker, database, API provider hay implementation nội bộ.  
> Bản này đã chốt theo cấu trúc gói mới: **Free/Light/Standard/Auth/Launch theo Hunter Layer**.  
> Trong v1 **không có Expert Human Review**. User approval là feature kiểm soát hành động, không phải human review.

---

# 1. Tổng quan sản phẩm

## 1.1. Tên sản phẩm

**AI White-hat Security Workspace**

## 1.2. Mô tả ngắn

AI White-hat Security Workspace là nền tảng kiểm thử bảo mật web/app có kiểm soát. Người dùng nhập domain, xác minh quyền sở hữu, chọn gói kiểm thử, có thể thêm test account, sau đó nhận báo cáo bảo mật dễ hiểu, báo cáo kỹ thuật cho AI/dev, bảng quản lý lỗi và công cụ retest từng lỗi sau khi sửa.

## 1.3. Định vị

Sản phẩm không phải scanner thông thường. Sản phẩm là workspace giúp người dùng đi qua vòng lặp:

```text
Phát hiện rủi ro → hiểu lỗi → sửa lỗi → retest → chứng minh đã xử lý
```

## 1.4. Giá trị cốt lõi

```text
- Free vẫn có “chất hunter”, không chỉ check header/cookie đơn giản.
- Gói trả phí dùng Strix attacker-mindset để tìm lỗi logic, phân quyền, API behavior và rủi ro khó thấy.
- OpenHack-style workflow giúp chuẩn hóa hunter layer, schema, report và review package.
- Report có 2 lớp: dễ hiểu cho founder/client và kỹ thuật cho AI/dev.
- Finding board giúp quản lý lỗi sau scan.
- Manual retest giúp kiểm tra lại từng lỗi sau khi sửa, không cần scan lại toàn bộ.
```

---

# 2. Scope v1

## 2.1. V1 làm gì

```text
- Nhập domain/URL.
- Xác minh quyền sở hữu domain.
- Khai báo phạm vi kiểm thử.
- Chọn gói Free / Light / Standard / Auth / Launch.
- Thêm test account nếu muốn kiểm tra phần sau đăng nhập.
- Hiển thị tiến trình kiểm thử dễ hiểu.
- Trả Hunter Snapshot / Human Report / AI-dev Report tùy gói.
- Tạo finding board.
- Cho phép user chuyển trạng thái lỗi.
- Cho phép manual retest từng finding.
- Có User Approval Gate cho hành động nhạy cảm.
```

## 2.2. V1 không làm gì

```text
- Không GitHub repo access.
- Không Jira / Linear.
- Không CI/CD auto retest.
- Không tự chạy scan sau mỗi lần deploy.
- Không xác minh VPS / cloud account.
- Không scan private network.
- Không cài agent lên server.
- Không mobile APK audit.
- Không tự sửa code.
- Không Expert Human Review trong v1.
- Không cam kết luôn tìm thấy lỗi.
```

---

# 3. Đối tượng người dùng

## 3.1. Founder / chủ sản phẩm

Nhu cầu:

```text
- Biết web/app có rủi ro lớn không.
- Hiểu lỗi bằng ngôn ngữ dễ hiểu.
- Biết lỗi nào cần sửa trước.
- Có report để gửi dev, khách hàng hoặc nhà đầu tư.
```

## 3.2. Vibe coder / AI builder

Nhu cầu:

```text
- Build app nhanh bằng AI nên dễ thiếu security foundation.
- Muốn check nhanh lỗi phổ biến.
- Muốn có fix prompt đưa cho Codex, Claude Code, Cursor, Antigravity hoặc dev.
- Muốn retest sau khi sửa.
```

## 3.3. Dev team nhỏ / agency

Nhu cầu:

```text
- Cần danh sách lỗi rõ ràng.
- Cần report bàn giao khách hàng.
- Cần workflow quản lý lỗi tối giản.
- Không cần Jira/DevSecOps phức tạp trong v1.
```

---

# 4. Cấu trúc gói dịch vụ

## 4.1. Bảng gói theo Hunter Layer

| Gói | Hunter layer | Mục đích |
|---|---|---|
| **Free** | OpenHack-style mini hunter + Strix Mini Summary | Snapshot nhanh, có chất hunter, kéo lead |
| **Light** | OpenHack hunter đầy đủ hơn + limited Strix | Check nhanh app/MVP/vibe-code app với report có giá trị |
| **Standard** | Strix adversarial core + OpenHack schema/review workflow | Gói chính cho startup chuẩn bị launch/demo |
| **Auth** | Strix access-control hunter + OpenHack approval/evidence package | Kiểm tra phần sau đăng nhập, session, role, access-control |
| **Launch** | Strix + OpenHack + readiness package | Gói cao nhất trong v1, dùng trước launch/demo/B2B, không có expert human review |

> Ghi chú: “review workflow/package” trong v1 là **workflow/evidence package để user/dev tự xem và approve**, không phải chuyên gia bảo mật review.

---

# 5. Gói Free — Vibe-code Hunter Snapshot

## 5.1. Mục tiêu

Free phải cho user thấy hệ thống có “chất hunter”, không phải chỉ là check header/cookie rẻ tiền.

Free không phải full pentest.

Tên đúng:

```text
Free Vibe-code Hunter Snapshot
```

## 5.2. Hunter layer

```text
OpenHack-style mini hunter + Strix Mini Summary
```

## 5.3. Bao gồm

```text
- Domain verification.
- Lightweight browser observation.
- OpenHack-style mini hunter workflow.
- Mini exposure hunter.
- Frontend secret/storage hunter.
- API surface hunter.
- Auth/session smoke hunter.
- AI app smoke hunter nếu phát hiện chatbot/LLM.
- Strix Mini Summary.
- Snapshot score.
- Top observations.
- Findings / warnings / hardening.
- Public attack surface summary.
- What we could not test.
- Recommended next step.
- 1 simple retest cho lỗi đơn giản nếu có.
```

## 5.4. Không bao gồm

```text
- Full Strix adversarial reasoning.
- Authenticated scan.
- Multi-account access-control test.
- Deep business logic testing.
- AI/dev technical report đầy đủ.
- Expert Human Review.
- CI/CD auto retest.
```

## 5.5. Empty-state

Nếu không tìm thấy lỗi lớn, không ghi:

```text
Không phát hiện lỗi.
```

Phải ghi:

```text
Không phát hiện Critical/High trong phạm vi snapshot hiện tại.
```

Và kèm:

```text
- Đã kiểm tra gì.
- Đã quan sát bao nhiêu route/request/API.
- Warning/hardening nếu có.
- Phần chưa kiểm tra được.
- Bước tiếp theo.
```

---

# 6. Gói Light — Fast Vibe-code Security Check

## 6.1. Mục tiêu

Gói rẻ có thể bán, sâu hơn Free nhưng chưa phải full AI adversarial check.

## 6.2. Hunter layer

```text
OpenHack hunter đầy đủ hơn + limited Strix
```

## 6.3. Bao gồm

```text
- Toàn bộ Free.
- Browser observation nhiều route hơn.
- API surface summary đầy đủ hơn.
- OpenHack hunter workflow đầy đủ hơn.
- Limited Strix reasoning trên các bề mặt đáng nghi.
- Human-readable report.
- Fix prompt cơ bản cho từng finding.
- Finding board cơ bản.
- Một số lượt retest đơn giản.
```

## 6.4. Không bao gồm

```text
- Full Strix adversarial core.
- Authenticated access-control check sâu.
- Multi-account User A/User B test.
- Expert Human Review.
```

---

# 7. Gói Standard — AI White-hat Check

## 7.1. Mục tiêu

Gói chính cho startup, agency hoặc vibe-coded app chuẩn bị launch/demo.

## 7.2. Hunter layer

```text
Strix adversarial core + OpenHack schema/review workflow
```

## 7.3. Bao gồm

```text
- Toàn bộ Light.
- Strix attacker-mindset reasoning trong phạm vi đã xác minh.
- OpenHack schema để chuẩn hóa finding/report/retest.
- OpenHack review workflow để gom evidence, reasoning summary, remediation và retest suggestion.
- Prioritized findings.
- Severity/confidence.
- Business impact.
- Human-readable report.
- AI/dev-readable technical report.
- Fix prompt cho AI/dev.
- Manual retest từng finding.
- User Approval Gate cho action nhạy cảm.
```

## 7.4. Không bao gồm

```text
- Authenticated access-control check sâu nếu không có test account.
- Expert Human Review.
- CI/CD auto retest.
```

---

# 8. Gói Auth — Access Control Check

## 8.1. Mục tiêu

Gói tập trung vào lỗi sau đăng nhập: auth/session/role/access-control/API data exposure.

## 8.2. Hunter layer

```text
Strix access-control hunter + OpenHack approval/evidence package
```

## 8.3. Yêu cầu đầu vào

```text
- Domain đã xác minh.
- Scope đã khai báo.
- Ít nhất 1 test account.
- Tốt nhất 2 test accounts: User A / User B.
- Role label nếu user biết: normal, admin, editor, viewer...
```

## 8.4. Bao gồm

```text
- Toàn bộ Standard.
- Authenticated flow.
- Session/cookie/token checks.
- Role boundary checks nếu có role.
- User A/User B access-control checks nếu có 2 accounts.
- BOLA/IDOR suspicion and safe validation.
- Private data exposure checks.
- Admin-like endpoint visibility.
- OpenHack approval/evidence package cho finding nhạy cảm.
- User Approval Gate bắt buộc cho action nhạy cảm.
- Manual retest cho access-control finding.
```

## 8.5. Không bao gồm

```text
- Expert Human Review.
- Scan ngoài scope.
- Destructive action mặc định.
- CI/CD auto retest.
```

---

# 9. Gói Launch — Launch Readiness Check

## 9.1. Mục tiêu

Gói cao nhất trong v1, dùng trước launch, demo khách B2B hoặc gửi report cho đối tác/nhà đầu tư.

## 9.2. Hunter layer

```text
Strix + OpenHack + readiness package
```

## 9.3. Bao gồm

```text
- Standard hoặc Auth tùy scope.
- Report trình bày kỹ hơn.
- Readiness summary.
- Coverage summary.
- Priority fix plan.
- Retest package sau khi fix.
- Evidence package đã sanitize.
```

## 9.4. Không bao gồm

```text
- Expert Human Review trong v1.
- Bảo chứng “100% secure”.
- CI/CD auto retest.
```

## 9.5. Wording bắt buộc

Không ghi:

```text
Đã an toàn tuyệt đối.
```

Ghi:

```text
Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại.
```

---

# 10. Monthly / Monitor Plans

## 10.1. Nguyên tắc

Gói tháng không phải CI/CD auto retest.

Gói tháng bán:

```text
- Finding workspace.
- Report history.
- Retest quota.
- Reminders.
- Risk acceptance.
- Security score trend.
```

## 10.2. Monitor Lite

```text
- 1 project/domain.
- Lưu report.
- Finding board.
- Retest quota nhỏ.
- Reminder cơ bản.
```

## 10.3. Monitor Startup

```text
- Nhiều project/domain hơn.
- Report history dài hơn.
- Retest quota lớn hơn.
- Status workflow.
- Risk acceptance.
- Monthly summary nhẹ.
```

## 10.4. Monitor Pro

```text
- Team workspace cơ bản.
- Nhiều domain hơn.
- Authenticated findings tracking.
- Priority retest queue.
- Readiness package add-on.
```

---

# 11. User flow chi tiết

## 11.1. Flow tạo project và verify domain

```text
1. User tạo project.
2. User nhập domain.
3. Hệ thống hiển thị lựa chọn verify.
4. User chọn DNS TXT hoặc /.well-known file.
5. User hoàn tất verify.
6. Domain chuyển sang Verified.
7. User mới được chạy scan.
```

## 11.2. Flow Free

```text
1. User chọn Free Vibe-code Hunter Snapshot.
2. User xác nhận scope cơ bản.
3. Hệ thống chạy OpenHack-style mini hunter.
4. Hệ thống tạo Strix Mini Summary.
5. User nhận Snapshot Report.
6. User thấy top observations, warnings, hardening, coverage gaps.
7. User được gợi ý nâng lên Light/Standard/Auth nếu cần.
```

## 11.3. Flow Light

```text
1. User chọn Light.
2. Hệ thống chạy hunter sâu hơn Free.
3. Limited Strix phân tích các surface đáng nghi.
4. User nhận human-readable report.
5. User xem finding board.
6. User copy fix prompt cơ bản.
7. User retest lỗi đơn giản sau khi sửa.
```

## 11.4. Flow Standard

```text
1. User chọn Standard.
2. User xác nhận scope.
3. Hệ thống chạy Strix adversarial core trong verified scope.
4. OpenHack workflow chuẩn hóa finding/report/retest.
5. Nếu action nhạy cảm, hệ thống hỏi User Approval Gate.
6. User nhận human-readable report và AI/dev-readable report.
7. User sửa lỗi.
8. User manual retest từng finding.
```

## 11.5. Flow Auth

```text
1. User chọn Auth.
2. User thêm test account.
3. Nếu muốn kiểm tra User A/User B, user thêm 2 accounts.
4. Hệ thống kiểm tra phần sau đăng nhập.
5. Action nhạy cảm phải có User Approval Gate.
6. User nhận Access Control report.
7. User sửa lỗi.
8. User retest từng access-control finding.
```

## 11.6. Flow Launch

```text
1. User chọn Launch.
2. User chọn Standard hoặc Auth scope.
3. Hệ thống chạy kiểm thử theo scope.
4. User nhận report trình bày kỹ hơn.
5. User nhận readiness summary.
6. User fix theo priority plan.
7. User dùng retest package để kiểm tra lại lỗi sau khi sửa.
```

---

# 12. Feature requirements

## 12.1. Domain Verification

User có thể:

```text
- thêm domain;
- xác minh bằng DNS TXT;
- xác minh bằng /.well-known file;
- xem trạng thái pending/verified/failed/expired.
```

Yêu cầu:

```text
- domain chưa verified thì không scan được;
- hướng dẫn verify phải rõ;
- lỗi verify phải dễ hiểu.
```

## 12.2. Scope Setup

User có thể:

```text
- chọn allowed host;
- loại trừ path nhạy cảm;
- chọn gói scan;
- xác nhận có quyền kiểm thử.
```

## 12.3. Test Account Setup

User có thể:

```text
- thêm test account;
- gắn role nếu biết;
- thêm User A/User B nếu muốn check access-control;
- xóa test account.
```

UX phải nói rõ:

```text
Test account chỉ dùng trong phạm vi domain đã xác minh.
```

## 12.4. Live Progress

Hiển thị milestone:

```text
- Đang xác minh phạm vi kiểm thử.
- Đang mở website bằng browser thật.
- Đang quan sát request/API được frontend gọi.
- Đang chạy Hunter Snapshot.
- Đang phân tích các bề mặt rủi ro đáng chú ý.
- Đang tạo report.
```

Với Standard/Auth:

```text
- AI đang mô phỏng tư duy attacker trong phạm vi đã xác minh.
- Đang kiểm tra các luồng nhạy cảm.
```

## 12.5. Report

Free:

```text
Hunter Snapshot Report
```

Light trở lên:

```text
- Human-readable report.
- AI/dev-readable report nếu gói hỗ trợ.
```

Report phải có:

```text
- scope;
- top observations;
- findings/warnings/hardening;
- severity/confidence nếu có;
- business impact;
- fix guidance;
- limitations;
- next steps.
```

## 12.6. Finding Board

User có thể:

```text
- xem findings;
- lọc theo status/severity;
- mở finding detail;
- copy fix prompt;
- đổi trạng thái;
- bấm retest.
```

States:

```text
Open
In Progress
Ready for Retest
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
Accepted Risk
```

## 12.7. Manual Retest

Retest v1:

```text
- manual;
- theo từng finding;
- không scan lại toàn bộ app;
- không chạy sau deploy;
- có User Approval Gate nếu action nhạy cảm.
```

Kết quả:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

## 12.8. User Approval Gate

Hiển thị trước action nhạy cảm:

```text
- action sẽ chạy;
- domain/path liên quan;
- account sẽ dùng nếu có;
- điều hệ thống sẽ không làm;
- Approve / Cancel.
```

---

# 13. UX wording

## 13.1. Không hứa quá mức

Không dùng:

```text
100% secure.
Không có lỗi.
Tìm mọi lỗ hổng.
```

Dùng:

```text
Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại.
```

## 13.2. Luôn nêu limitation

Ví dụ:

```text
Chưa kiểm tra được phân quyền sau đăng nhập vì bạn chưa thêm test account.
```

## 13.3. CTA sau Free

```text
Muốn kiểm tra lỗi phân quyền, session và dữ liệu sau đăng nhập? Hãy thêm test account và chạy Auth Check.
```

---

# 14. Success metrics

## 14.1. Product metrics

```text
- Free Snapshot completion rate.
- Free → paid conversion.
- Tỷ lệ user thêm test account sau Free.
- Số report được export.
- Số finding được mark Ready for Retest.
- Số retest được chạy.
- Tỷ lệ finding chuyển Fixed.
```

## 14.2. Experience metrics

```text
- User có hiểu report không?
- Free report có bị cảm giác trống không?
- User có biết bước tiếp theo không?
- User có copy fix prompt không?
- User có quay lại retest không?
```

---

# 15. Acceptance summary ở mức sản phẩm

PRD v1 đạt khi sản phẩm cho phép:

```text
- tạo project;
- thêm và verify domain;
- chạy Free Hunter Snapshot đúng cấu trúc;
- chạy Light/Standard/Auth/Launch theo đúng hunter layer;
- Free report có giá trị dù không tìm thấy lỗi lớn;
- thêm test account cho Auth;
- xem finding board;
- copy AI fix prompt;
- manual retest từng finding;
- dùng User Approval Gate cho action nhạy cảm;
- export human-readable report;
- export AI/dev-readable report ở gói phù hợp.
```

Không đạt nếu:

```text
- Free chỉ là header/cookie scan đơn giản;
- report trả “không có lỗi” mà không có coverage/limitation;
- package không khớp hunter layer đã chốt;
- còn ghi Expert Human Review như benefit v1;
- user không biết bước tiếp theo;
- không có finding board;
- không có manual retest;
- nhầm User Approval Gate với Expert Human Review.
```
