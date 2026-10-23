## Kết quả cần giao

Một người dùng chọn **Standard** và cấp scope hợp lệ: worker thật khám phá/kiểm thử, tạo candidate có bằng chứng; #14 xác minh độc lập; OpenHunterAI trả report có finding thật **hoặc** coverage gap trung thực. Một bài E2E nội bộ chứng minh được chuỗi **scan → finding → sửa lỗi → manual retest**. Đây là kiểm thử **OpenHunterAI**, không phải tính năng xây sản phẩm “lab”; người dùng bình thường không cần deploy canary.

**Đầu mối:** @khvavuong (assignee hiện tại). **M0.** Có thể chia PR nhỏ theo các chặng dưới đây. #13 sở hữu request/lifecycle, #14 sở hữu independent validation/retest, #12 sở hữu CLI/dashboard. Issue này sở hữu **worker thực thi + target/scorer kiểm thử + bằng chứng E2E**, không thay phần việc của họ.

**Contract tích hợp:** benchmark gọi `scan_request_v2` qua cùng public API/CLI, chấm `report_v2` và không suy diễn finding từ candidate của worker.

## Hiện trạng cần xử lý

- Compose mặc định mới có Strix adapter; runtime/model/sandbox chưa được chứng minh sẵn sàng. ZAP hiện chủ yếu passive; Nuclei có curated hardening template; built-in `openhack_hunter` là passive-surface checker, không phải OpenHack runtime. “Planned” hay `health=200` không chứng minh đã kiểm thử XSS/SQLi/IDOR.
- `tools/eval/canary-target/` mới là fixture IDOR sơ bộ; chưa có một lần **positive finding → fix → real retest** được chứng minh trên release. URL-only coverage scan và unit test parser không đủ đóng issue.
- Smoke Standard ngày 20/09/2026 với Chromium 131 và `chromedp v0.9.5`/`cdproto` 02/2024 vẫn thu được page metadata nhưng log nhiều `could not unmarshal event ... cookiePart...`. Cần pin/kiểm tra tương thích CDP và chứng minh network-event/evidence không bị mất; nếu không chứng minh được thì ghi coverage gap, không gọi browser execution là đầy đủ.

## Việc cần làm — theo thứ tự PR

### A. Target và thước đo nội bộ (có thể làm song song #13)

- [ ] Mở rộng **một** web app test Docker reset được từ `tools/eval/canary-target/`: reflected XSS, SQL injection, IDOR/BOLA hai account. Mỗi lớp có vulnerable, fixed và matched negative control; dữ liệu giả. App có luồng UI/API bình thường để scanner tự khám phá, không inject đáp án vào engine.
- [ ] Runner/test target chạy trong mạng benchmark cô lập, chỉ truy cập host/service đã khai báo và xác nhận quyền. Chặn metadata, host/LAN khác, Internet tùy ý và redirect ngoài scope. Nếu test cần địa chỉ Docker private, chỉ thêm ngoại lệ **test-only, đúng service**, có ADR + scope tests; không thêm global `skipGuardrails` hoặc nới production guard.
- [ ] Ground truth nằm riêng trong scorer; worker/validator không được đọc source hay manifest đáp án. Scorer tiêu thụ `report_v2` và evidence thật để đo recall từng lớp, false-positive, evidence completeness, retest accuracy, coverage gaps, thời gian/request/cost (N/A + lý do nếu chưa đo được).

### B. Worker thực thi, không chỉ lên kế hoạch

- [ ] Bảng năng lực ngắn Quick/Standard/Deep × worker × XSS/SQLi/IDOR: executor, prerequisite, evidence, lý do skip. Standard gọi executor thật trong budget/rate limit; thiếu worker/model phải là `skipped/coverage_gap`, không âm thầm đổi thành Quick.
- [ ] Pin và đóng gói runtime cần thiết (bao gồm Strix nếu profile dùng nó), cấu hình provider qua đường chung, kiểm tra runtime **installed/configured/reachable/executable**. Sandbox giới hạn quyền/egress/tài nguyên và cleanup khi timeout/cancel; không mặc định trao Docker host socket toàn quyền.
- [ ] Từ target và session, khám phá form/API/object rồi chạy bounded, non-destructive probes cho XSS thực thi, SQLi có control, IDOR/BOLA hai identity và ownership. Chọn executor phù hợp; không tạo worker ID mới chỉ để thêm playbook. Không dùng 401/403/422, SQL error đơn lẻ, reflected text chưa execute hay public object làm bằng chứng lỗi.
- [ ] Mỗi candidate có baseline + probe exchange, counterevidence, impact quan sát được, artifact ref/hash và provenance để #14 tự replay. `WorkerRunResult` ghi status, attempted/completed/skipped/gaps, errorCode/retryable. Failed probe là unknown/retryable, không phải tested-negative; worker không tự đặt `validated`. Mọi request/redirect/subrequest giữ đúng scope và session isolation.
- [ ] Audit import Strix/OpenHack/Claude-BugHunter/Nuclei/ZAP theo exact ref/digest, license và contract test; chỉ nhập thứ sửa failure mode hoặc cải thiện metric mà không tăng false positives. Không auto-sync/vendor cả repo.

### C. E2E thật và release gate (tích hợp #12/#13/#14)

- [ ] Một lệnh dựng/reset engine + test target, chạy **public API và CLI thật** với Standard, dashboard smoke cùng run; không thao tác DB/NATS để tạo finding. Bước đầu: **1 positive + 1 matched negative → candidate → #14 validation → report → sửa target → manual retest fixed**. Lưu artifact trước khi mở rộng.
- [ ] Gate đầy đủ: trong **cùng một run** có 3/3 lớp XSS/SQLi/IDOR được independently validated, 0/3 matched negatives thành finding, 100% promoted findings có evidence chain. Lặp từ clean reset **3 lần**; sửa cả ba → 3/3 fixed; bật vulnerable lại → still reproducible. Timeout/404/unreachable không được tính fixed.
- [ ] Failure controls: SPA/404 shell, validation-layer response, expired account, target unreachable, missing worker, malformed output, duplicate callback, cancel/timeout. Missing worker luôn tạo gap; callback trùng không nhân bản finding/report; out-of-scope requests = 0.
- [ ] Nộp lệnh tái lập từ fresh checkout/release, scorer/baseline JSON, worker manifest, `report_v2` trước/sau, sanitized logs/evidence, image/commit/model/config refs và screenshot/terminal recording CLI + dashboard. **Không cần public staging hay DNS challenge để chạy benchmark nội bộ.**

## Ranh giới nghiệm thu

Chỉ gọi profile Standard “đã kiểm thử” nếu runtime thật chạy và evidence hiện diện. Bộ ba lỗi trên là **gate tối thiểu**, không phải tuyên bố tìm được mọi lỗi trên mọi website. Không benchmark bằng cách tấn công website bất kỳ; không mở cloud/AD/mobile/web3, unrestricted exploit hoặc bỏ scope/rate/resource guardrails. #22 chỉ đóng sau khi các PR đã merge và gate E2E chạy trên artifact tái lập được, không dựa vào draft local.

**Gộp từ #15:** giữ lịch sử thảo luận ở #15; mọi công việc và tiêu chí chưa hoàn thành của #15 nay được theo dõi tại đây.
