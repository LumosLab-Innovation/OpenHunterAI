## Mục tiêu

Worker chỉ đưa ra **candidate**. OpenHunterAI chỉ công bố **finding** sau khi một validator độc lập kiểm tra lại tác động và bằng chứng trong scope. Sau khi người dùng sửa lỗi, manual retest kiểm tra lại đúng scenario đó và trả **fixed / still reproducible / inconclusive**.

**Phụ trách cần giao:** BE evidence/validation + security engineer (chưa có assignee). **Ưu tiên:** M0. Dùng lifecycle #13, candidate/evidence và web app kiểm thử từ #22.

**Contract đầu vào:** #13 đã chuẩn hóa `scan_request_v2` và `report_v2`. Cho đến khi executor retest/replay của issue này có thật, API phải trả `RETEST_UNSUPPORTED`, không tạo kết quả fixed giả.

## Việc dev cần làm

1. Lưu evidence đã sanitize có thể truy xuất: baseline + probe HTTP/browser exchange, hash, scope, run/candidate, thời điểm và validator version. Secret dùng reference riêng; một chuỗi `http_exchange:...` hoặc confidence của worker không đủ làm bằng chứng.
2. Validator độc lập **replay** trong cùng policy/scope: reflected XSS phải thực thi trong browser context; SQLi phải có baseline/control và tác động tái lập; IDOR/BOLA phải chứng minh account A đọc/sửa object của B mà A không được phép. Kiểm tra cả counterevidence và negative controls; không tin nhãn `validated` do worker gửi.
3. Mỗi candidate có một quyết định hiện hành `rejected | needs_more_evidence | validated` với lý do và lịch sử attempts. Chỉ `validated` mới thành finding/report; severity theo impact đã chứng minh. Retry/callback trùng không nhân bản finding.
4. Lưu scenario retest hẹp cho từng finding. Khi người dùng yêu cầu, chạy lại baseline/probe/control, lưu evidence trước/sau. Timeout, 404, mất kết nối, hết session hoặc artifact sai scope → **inconclusive/needs_more_evidence**, không phải `fixed` hay `rejected`.

## Xong khi

- Web app kiểm thử trong #22 cho ít nhất một finding thật ở **XSS, SQLi, IDOR/BOLA**; mọi finding có chain baseline → probe → independent validator, replay/audit được. Matched negative controls không thành finding.
- Sửa cả ba scenario → retest `fixed`; bật vulnerable lại → `still reproducible`. High/Critical thiếu replay/impact/counterevidence không được promote.
- Test các case fake ref, artifact khác host/run/account, secret trong evidence, validator crash/retry/cancel và target unreachable. Cung cấp schema, test, sanitized replay logs và `report_v2` trước/sau; không chỉ unit test metadata.

**Không thuộc issue này:** tạo probe worker hoặc fixture/scorer (#22), xóa quota/thiết kế scan request (#13), dùng LLM vote thay replay.

**Tình trạng đã biết (audit 20/09/2026):** local `validation.ts` mới kiểm hình dạng metadata; chưa tự fetch/replay evidence. Legacy retest đi qua passive adapter và trả `RETEST_UNSUPPORTED`. Chưa có finding thật + fix + retest được chứng minh.
