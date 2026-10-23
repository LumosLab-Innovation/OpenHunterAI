# Nghiên cứu requirement packs AU và GB

Rà nguồn chính thức ngày **2026-10-08**. Hai pack chứa **40 predicate AU** và **39 predicate GB** được diễn đạt lại, gắn locator đến mục gốc, phạm vi áp dụng và loại bằng chứng cần có. `id` và `factId` do OpenHunterAI đặt để xử lý dữ liệu; chúng không phải mã control của cơ quan ban hành.

Các pack là bản trích **partial**. Kết quả chỉ thể hiện đánh giá các khai báo đã nhập cho những rule đã mã hóa. Rule bị bỏ sót, phạm vi chưa chứng minh, ngoại lệ, tài liệu thiếu và review chưa thực hiện phải tiếp tục hiện thành gap. Một boolean `true` hoặc đường dẫn artifact không chứng minh cấu hình thực tế.

## Australia

Nguồn: [ASD Essential Eight maturity model, November 2023](https://www.cyber.gov.au/sites/default/files/2025-03/Essential%20Eight%20maturity%20model%20(November%202023).pdf), Appendices A/B/C và bảng so sánh D. Số trang trong pack là số trang in trên tài liệu; PDF viewer có thể dùng chỉ số khác. Tài liệu ghi giấy phép CC BY 4.0 ở trang 34; pack dẫn lại tên tài liệu, cơ quan và URL, không sao chép toàn bộ nội dung.

Các khác biệt được giữ thành rule riêng thay vì tăng một điểm maturity chung:

- Level 2 bổ sung phạm vi MFA cho tài khoản hệ thống, tính chống phishing và kiểm soát vòng đời quyền quản trị.
- Level 3 tăng yêu cầu cho data repository, cách dùng MFA của khách hàng, workstation quản trị, JIT, driver allowlisting và bảo vệ backup trong thời gian giữ lại.
- Các nhóm phần mềm có hạn vá khác nhau. Chu kỳ tháng giữ nguyên đơn vị tháng; không đổi thành 30 ngày.
- Level 0 không có baseline có thể đạt trong pack này.

Pack không mã hóa hết từng câu trong tám chiến lược. Chẳng hạn các nội dung về phân tích log, reporting sự cố, chữ ký macro, toàn bộ chính sách hardening, một số phạm vi vá hoặc lịch giữ backup còn cần mở rộng từ đúng mục gốc. Vì vậy vượt qua các rule được chọn không xác định maturity level của tổ chức.

## United Kingdom

Nguồn: [NCSC Cyber Essentials technical requirements v3.3](https://www.ncsc.gov.uk/files/cyber-essentials-requirements-for-it-infrastructure-v3-3.pdf), Sections C/D và E.1–E.5; [trang phiên bản hiện hành](https://www.ncsc.gov.uk/cyberessentials/resources) ghi ngày có hiệu lực 27-04-2026. [So sánh chứng nhận của NCSC](https://www.ncsc.gov.uk/cyberessentials/overview) là nguồn cho review kỹ thuật độc lập của Plus.

Hai cấp chứng nhận dùng chung năm nhóm technical controls. Plus có thêm rule `manual` cho việc kiểm thử bởi assessor độc lập; một kết quả harness không thay thế assessor hoặc cấp chứng nhận.

Hạn 14 ngày được áp dụng theo điều kiện severity của bản vá, không áp cho mọi update. MFA cloud là yêu cầu riêng. Các lựa chọn bảo vệ mật khẩu được giữ thành profile có điều kiện; source không đưa ra một thời hạn vô hiệu hóa account chung để pack tự áp đặt. Backup, cấu hình throttle và hai nhóm bảo vệ mật khẩu dùng từ SHOULD được ghi là recommendation, không tính thành mandatory conformance. Riêng yếu tố mật khẩu trong MFA có câu MUST yêu cầu tối thiểu tám ký tự và không hạn chế độ dài tối đa; pack giữ thành một rule mandatory riêng.

## Cách chuẩn bị observations

Các bước dưới đây là quy ước kiểm tra của OpenHunterAI, không phải quy trình chứng nhận do ASD/NCSC phê duyệt:

| Nhóm fact | Operator cần chuẩn bị | Lỗi cần tránh |
|---|---|---|
| Khoảng thời gian scan | Nhật ký đã sanitize, thời kỳ đánh giá, inventory đối chiếu và khoảng cách lớn nhất giữa các lượt | Chỉ dùng ngày scan mới nhất để suy ra cả chu kỳ |
| Độ trễ vá | Ngày vendor phát hành, điều kiện severity/exploit, ngày triển khai được kiểm tra, phạm vi áp dụng | Dùng giá trị trung bình hoặc ngày tải về thay cho ngày triển khai |
| Số tháng | Hai mốc lịch và cách tính calendar month đã được reviewer chấp nhận | Đổi một tháng thành 30 ngày |
| MFA và quyền quản trị | Export cấu hình đã sanitize, toàn bộ account/service scope, đường fallback và review của người phụ trách | Suy ra enforcement từ một trang login hoặc tên tính năng |
| Allowlisting và hardening | Policy hiệu lực, phân bố thiết bị, phần mềm, ngoại lệ và xác nhận ngữ cảnh | Chỉ cung cấp policy template chưa áp dụng |
| Backup restore | Hồ sơ của lượt restore hoàn thành, phạm vi đã phục hồi và review độc lập | Coi job backup đã cấu hình là bằng chứng restore |
| Predicate manual | Chủ thể review, chủ đề cần quyết định và reference đã sanitize | Tự tạo approval từ một ID reviewer khác ID producer |

Khi không có dữ liệu áp dụng hoặc chưa xác nhận được toàn bộ population, kết quả cần là unknown/needs-review cùng gap. Chỉ nhập false cho applicability sau khi chủ thể phụ trách đã xác định và giải thích phạm vi. Các pack không thu thập cấu hình, gửi request, chạy scan, brute force, replay exploit hay thực hiện restore.
