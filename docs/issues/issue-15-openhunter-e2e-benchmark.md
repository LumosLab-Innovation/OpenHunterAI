> Superseded by #22. This file preserves the pre-merge issue brief; the live acceptance checklist is now in #22.

## Đây là kiểm thử OpenHunterAI, không phải sản phẩm “lab”

#15 dùng **một web app cố ý có lỗi, chạy nội bộ** như dữ liệu kiểm thử có đáp án. Nó chứng minh OpenHunterAI thực sự tìm lỗi, không báo nhầm, tạo report và retest sau khi sửa. Người dùng bình thường chỉ nhập URL được cấp quyền; **không cần deploy canary, fixture hay “lab”**.

**Phụ trách cần giao:** QA/benchmark + pentest engineer (chưa có assignee). **Ưu tiên:** M0. Có thể dựng fixture/scorer song song #13; nghiệm thu tích hợp chờ #12/#13/#22/#14.

## Việc dev cần làm

1. Mở rộng fixture hiện có ở `tools/eval/canary-target/` thành **một** web app test reset được trong Docker: reflected XSS, SQL injection, IDOR/BOLA với hai account. Mỗi lỗi có trạng thái vulnerable, bản fixed và negative control tương ứng; dữ liệu đều là giả. Đây là test dependency, không phải UI/product mới.
2. Chạy fixture trong mạng benchmark cô lập; chỉ runner test được truy cập đúng service/host đã khai báo và có xác nhận quyền. Chặn host/LAN/metadata, Internet tùy ý và redirect ra ngoài scope. Nếu cần ngoại lệ cho private Docker address, nó chỉ tồn tại trong test profile, ràng buộc đúng service và có test/ADR; **không** thêm `skipGuardrails` toàn cục hoặc nới policy self-host thông thường.
3. Một lệnh dựng/reset target + engine, gọi **API thật và CLI thật** với profile Standard, rồi đọc `report_v2`; dashboard có smoke cùng run. Engine không được biết đáp án, đọc source/manifest ground truth hoặc nhận finding dựng sẵn. Scorer giữ đáp án riêng và so sánh report; không sửa DB/NATS để tạo kết quả đẹp.
4. Đo recall theo XSS/SQLi/IDOR, false-positive trên controls, evidence completeness, retest accuracy, coverage gaps, thời gian/request/cost (ghi N/A + lý do nếu không đo được). Thêm failure controls tối thiểu: SPA/404 shell, response chỉ do validation layer, target unreachable, expired account, missing worker, duplicate callback.

## Cách triển khai và nghiệm thu

- **Vertical slice trước:** một positive + một matched negative → candidate → independent validation → `report_v2` → sửa target → manual retest `fixed`. Lưu artifact thật; không chờ đủ ba lớp mới chạy end-to-end.
- **Release gate M0:** sau reset, trong **cùng một run Standard** có 3/3 positive classes được xác minh độc lập, 0/3 matched negatives thành finding, và 100% finding có evidence chain. Lặp lại ba lần từ trạng thái sạch. Sửa cả ba → 3/3 `fixed`; khôi phục bản vulnerable → `still reproducible`. Timeout/404 không được tính fixed.
- Missing worker luôn tạo gap, duplicate callback không tạo finding/report trùng, out-of-scope request = 0. Lưu lệnh tái lập, baseline/scorer JSON, `report_v2` trước/sau, log đã sanitize, image/commit/model/config refs và video ngắn CLI/dashboard. Test phải chạy từ fresh checkout/release **không cần public staging hoặc DNS challenge**.

**Giới hạn kết luận:** bộ ba lỗi là release gate tối thiểu, không chứng minh sản phẩm tìm được mọi lỗi trên mọi website. Không dùng website bên thứ ba để “cố tìm lỗi” làm benchmark. Vẫn giữ guardrail và approval gate bình thường.
