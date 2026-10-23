# Nguồn dữ liệu tuyển chọn

Nguồn được đối chiếu thủ công ngày 08/10/2026. Không có cron, auto-sync,
submodule hoặc toàn bộ repository upstream trong harness này.

## OWASP ASVS

`web-assurance.json` chứa metadata ID, chapter và minimum level của OWASP
Application Security Verification Standard Project, phiên bản 5.0.0,
[release v5.0.0_release](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release),
commit `5cf9b032440be53ce345ab3c130fda46ba1ce7a2`. Giữ attribution của dự án
OWASP ASVS và giấy phép [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
cho tập dữ liệu này, theo [LICENSE của nguồn](https://raw.githubusercontent.com/OWASP/ASVS/5cf9b032440be53ce345ab3c130fda46ba1ce7a2/LICENSE.md).

Thay đổi: nhập 345 IDs/chapter/mức tối thiểu, chuyển trường mức thành số,
bổ sung crosswalk tuyển chọn, các mục tiêu scenario do OpenHunter viết và
giới hạn đánh giá. Pack `int-owasp-asvs.requirements.json` bổ sung 37 diễn
giải tuyển chọn, membership mức bản địa, điều kiện phạm vi và yêu cầu review
bằng chứng. Metadata và diễn giải ASVS tuyển chọn giữ CC BY-SA 4.0.
Không nhập toàn bộ mô tả requirement. Không có tuyên bố
OWASP phê duyệt OpenHunter hoặc xác nhận kết quả của harness.

## ASD Essential Eight

Nguồn: Australian Signals Directorate, *Essential Eight maturity model
(November 2023)*, theo giấy phép CC BY 4.0 ghi trong PDF. Attribution:
[ASD, bản nguồn chính thức](https://www.cyber.gov.au/sites/default/files/2025-03/Essential%20Eight%20maturity%20model%20(November%202023).pdf).
Pack AU giữ nguồn/mục/trang, diễn đạt lại 40 mục tuyển chọn thành dữ kiện và
điều kiện đánh giá. Không nhập toàn bộ tài liệu hoặc biểu trưng cơ quan.

## Việt Nam và NCSC

Pack Việt Nam dẫn văn bản và metadata tiêu chuẩn từ Công báo/CSDL/VSQI;
nguồn cụ thể nằm trong pack và `VN.md`. Không nhập toàn văn tiêu chuẩn có phí
hoặc đưa bản cũ bị thay thế thành baseline mới.

Pack GB dẫn [NCSC Requirements v3.3](https://www.ncsc.gov.uk/files/cyber-essentials-requirements-for-it-infrastructure-v3-3.pdf).
Tài liệu ghi UK Crown Copyright. Pack chỉ ghi các dữ kiện/điều kiện được
tuyển chọn, locator và diễn giải của OpenHunter; không phát hành lại PDF hay
câu hỏi đánh giá có giấy phép.

## Nguồn đa quốc gia

Các batch trong `expansion/` và từng pack mới dẫn cơ quan ban hành, edition,
locator và phạm vi. JSON chỉ chứa điều kiện/dữ kiện tuyển chọn và diễn giải
của OpenHunter; không phát hành lại toàn bộ tài liệu, ngân hàng câu hỏi,
tiêu chuẩn có phí hoặc logo của cơ quan. Không có tuyên bố cơ quan ban hành
phê duyệt công cụ hay chứng nhận kết quả.

`global-directory.json` chứa tên và mã định danh thống kê trong bảng
[UN Statistics Division M49](https://unstats.un.org/unsd/methodology/M49).
Đó là metadata nghiên cứu, không phải điều khoản an toàn thông tin hay đánh
giá pháp lý về chủ quyền. `jurisdiction-identifiers.json` là crosswalk định
danh riêng của OpenHunter, không được gán cho bảng UN.

ISO/IEC 27001 chỉ có tham chiếu metadata chính thức; toàn văn có giấy phép
và nội dung Annex A chưa được nhập. Các nguồn không đọc được toàn văn giữ
giới hạn và coverage gap trong catalog, thay vì tạo checklist suy đoán.
