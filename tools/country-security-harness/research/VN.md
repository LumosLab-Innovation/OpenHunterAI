# Việt Nam: nghiên cứu và tập yêu cầu theo điều khoản

Rà soát ngày **08/10/2026**. Pack: [vn-system-levels.requirements.json](../packs/vn-system-levels.requirements.json), `vn-n331-2026-curated`.

## Phạm vi đã đọc

Đã tải và đọc toàn văn DOCX cùng phụ lục của **Nghị định 331/2026/NĐ-CP** từ trang Công báo chính thức. Nội dung pack được diễn giải từ từng điều/khoản/điểm, gồm hồ sơ, thẩm quyền, quản lý rủi ro, điều kiện trước vận hành, kiến trúc thuê DC/cloud, báo cáo và chuyển tiếp.

Pack có **89 yêu cầu tuyển chọn**, gồm **62 boolean, 2 số giờ và 25 mục rà soát thủ công**. Số này bao gồm các nhánh áp dụng riêng cho cấp độ và hệ thống quan trọng về an ninh quốc gia; không tương ứng 89 điều luật độc lập. Đây là coverage một phần.

| Nguồn chính thức | Bản/điểm đối chiếu | Đã tiếp cận |
|---|---|---|
| [Nghị định 331/2026/NĐ-CP – Công báo](https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-331-2026-nd-cp-470334.htm) | Ban hành và hiệu lực 19/08/2026; 40 điều; phụ lục 8 mẫu | Toàn văn DOCX, gồm phụ lục |
| [Luật 116/2025/QH15 – Công báo](https://congbao.chinhphu.vn/van-ban/luat-so-116-2025-qh15-468678/61574.htm) | Điều 8, 44–45; hiệu lực 01/07/2026 | Toàn văn DOCX ban hành; cần đối chiếu sửa đổi trước quyết định thực tế |
| [TCVN 14423:2026 – VSQI](https://tieuchuan.vsqi.gov.vn/tieuchuan/view?sohieu=TCVN+14423%3A2026) | QĐ 3243/QĐ-BKHCN ngày 24/07/2026; trạng thái A; 114 trang | Chỉ danh mục/phạm vi/trạng thái; chưa có toàn văn |
| [TT12/2022/TT-BTTTT – lịch sử CSDL quốc gia](https://vbpl.moj.gov.vn/bothongtin/Pages/vbpq-lichsu.aspx?ItemID=155415) | Hướng dẫn NĐ85/2016, có ý nghĩa khi đối chiếu hồ sơ chuyển tiếp | Tham chiếu lịch sử; chưa đưa phụ lục vào pack mới |
| [Khung kiến trúc an ninh mạng quốc gia 1875/QĐ-TTg](https://xaydungchinhsach.chinhphu.vn/khung-kien-truc-an-ninh-mang-quoc-gia-119260930150219682.htm) | Ban hành 30/09/2026, phiên bản 1.0 | Trang công bố và dẫn toàn văn; chưa tích hợp các yêu cầu trong quyết định |

Bản DOCX Công báo NĐ331 đã dùng có SHA-256 `DB2430BB6A6A8DDD07935B13D2E4AD654B7FF62F87E71CCCC390B1AD71049AFC`. Bản DOCX Luật116 có SHA-256 `B3BB2AD8E013881361A7AE2325AECB660D55E41F48755ED590A6F23CB44D1150`. Hash nhận diện bản nghiên cứu, không chứng minh nội dung là bản hợp nhất mới nhất. Không đưa bản tải về vào repo.

## Thay đổi căn cứ cần lưu ý

1. **NĐ331 đã có hiệu lực**, nên NĐ85/2016 không được dùng làm căn cứ duy nhất cho yêu cầu hiện hành. Điều 39 NĐ331 có nhánh chuyển tiếp cho dự án đang đầu tư/xây dựng trước 01/07/2026. Luật116 Điều 45 còn cần đối chiếu cho hệ thống đã được phê duyệt.
2. **TCVN14423:2026 thay thế cả TCVN14423:2025 và TCVN11930:2017**, theo danh mục VSQI. Không gán các ngưỡng kỹ thuật của bản 2017/2025 cho bản 2026 khi chưa đọc toàn văn.
3. Điều 29 khoản 1 và Điều 30 khoản 1 NĐ331 dẫn tới tiêu chuẩn quốc gia về yêu cầu cơ bản. Pack giữ một mục manual để yêu cầu crosswalk theo toàn văn tiêu chuẩn; không diễn giải việc có một tài liệu thành đã đáp ứng tiêu chuẩn.
4. **Điều 2** xác định phạm vi hoạt động xây dựng/thiết lập/quản lý/vận hành/nâng cấp/mở rộng tại Việt Nam phục vụ ứng dụng CNTT cơ quan nhà nước hoặc dịch vụ trực tuyến cho người dân/doanh nghiệp; tổ chức ngoài phạm vi được khuyến khích áp dụng. Địa chỉ website hoặc tên miền không tự chứng minh phạm vi pháp luật.
5. Cơ quan thẩm định/nhận báo cáo và ngoại lệ quân sự/cơ yếu phải được xác định theo từng điều. Dữ liệu đề xuất cấp độ, lựa chọn trong harness và quyết định chính thức là các trạng thái khác nhau.
6. [Lịch sử Luật116 trên CSDL quốc gia](https://vbpl.moj.gov.vn/TW/Pages/vbpq-lichsu.aspx?ItemID=187039&Keyword=&dvid=13) cần được kiểm tra khi lập hồ sơ pháp lý, gồm các văn bản sửa đổi được cơ sở dữ liệu ghi nhận. Lần truy cập bổ sung cuối của trang VBPL trả 502; không dùng kết quả truy cập này để khẳng định toàn bộ luật không có sửa đổi.

## Những khác biệt theo cấp độ được mã hóa

| Nội dung | Cấp độ/điều kiện | Căn cứ |
|---|---|---|
| Thẩm định/phê duyệt đơn vị chuyên trách và báo cáo chủ quản | 1, 2 | Điều 18 khoản 1 |
| Đơn vị chuyên trách thẩm định, chủ quản phê duyệt | 3, có ngoại lệ hệ thống quan trọng quốc gia | Điều 18 khoản 2; Điều 20 khoản 4 |
| Thẩm định theo thẩm quyền BCA/BQP/Ban Cơ yếu, chủ quản phê duyệt | 4, có ngoại lệ hệ thống quan trọng quốc gia | Điều 18 khoản 3; Điều 20 khoản 4 |
| Thẩm quyền phê duyệt danh mục và phương án riêng | 5 | Điều 18 khoản 3 điểm d, đ |
| Ý kiến đơn vị chuyên trách và phân tích rủi ro chi tiết | 4, 5 | Điều 21 khoản 5; Điều 22 khoản 5 |
| Xem xét dùng chung giải pháp bảo vệ/tài nguyên | 1, 2, 3 | Điều 30 khoản 5 điểm a |
| Sẵn sàng, phân tách, hạn chế ảnh hưởng dây chuyền | 4, 5 | Điều 30 khoản 5 điểm b |
| Tách hệ thống/vùng mạng/lưu trữ về lô-gic; kiểm soát truy cập | Thuê DC/cloud, cấp 3, 4 | Điều 30 khoản 8 |
| Tách hệ thống/lưu trữ/thiết bị mạng chính về vật lý; vùng mạng về lô-gic | Thuê DC/cloud, cấp 5 **hoặc** quan trọng quốc gia | Điều 30 khoản 9 điểm a–d |
| Giới hạn giải pháp bảo vệ dùng chung, không can thiệp nội bộ | Nhánh khoản 9 và có giải pháp dùng chung | Điều 30 khoản 9 điểm đ |
| Tổ chức chuyên môn có tư cách phù hợp đánh giá | Cấp 5, quan trọng quốc gia và các trường hợp khác | Điều 31 khoản 2 điểm c |

Điều 30 khoản 2 nói baseline không bao gồm yêu cầu an ninh vật lý. Quy định phân tách vật lý tại khoản 9 vẫn phải được đối chiếu khi đáp ứng điều kiện; không được loại bỏ khoản 9 bằng cách viện dẫn khoản 2.

Điều 30 khoản 9 dùng phép **OR**. Hợp đồng pack hiện dùng điều kiện **AND**, nên mỗi mục khoản 9 có một nhánh cấp 5 và một nhánh cấp 1–4 kèm `national_critical=true`. Cách liệt kê nhánh thứ hai không khẳng định cấp độ 1/2 thường được xác định quan trọng quốc gia. Nó bảo toàn điều kiện trong văn bản mà không suy ra cấp độ từ thuộc tính khác. Khi hồ sơ xác định quan trọng quốc gia của cấp 3/4 có ý nghĩa với quy trình phê duyệt, mục manual Điều 20 khoản 4 yêu cầu đối chiếu.

## Thời hạn thực sự có trong nguồn

| Nghĩa vụ | Thời hạn | Xử lý trong pack |
|---|---|---|
| Phản hồi/hướng dẫn hồ sơ chưa hợp lệ | 5 **ngày làm việc** từ nhận hồ sơ | Manual; Điều 23 khoản 2 |
| Thẩm định hồ sơ cấp 3 | 15 **ngày làm việc** từ nhận đủ hồ sơ hợp lệ | Manual; Điều 23 khoản 3 điểm a |
| Thẩm định hồ sơ cấp 4/5 | 25 **ngày làm việc** từ nhận đủ hồ sơ hợp lệ | Manual; Điều 23 khoản 3 điểm b |
| Xử lý hồ sơ phê duyệt | 7 **ngày làm việc** từ nhận đủ hồ sơ hợp lệ | Manual; Điều 24 khoản 2 |
| Báo cáo nguyên nhân, ảnh hưởng, biện pháp khắc phục sự cố | 72 giờ từ phát hiện; sự cố phức tạp có báo cáo sơ bộ/cập nhật/kết thúc | Number; Điều 31 khoản 2 điểm d |
| Thông báo ban đầu sự cố nghiêm trọng | 24 giờ từ phát hiện | Number; Điều 31 khoản 2 điểm d |
| Báo cáo sự cố có dấu hiệu quốc gia/xã hội hoặc gián đoạn nghiêm trọng | Ngay khi phát hiện | Manual, không tự gán số giờ |
| Kỳ dữ liệu báo cáo năm | 15/12 năm trước–14/12 năm báo cáo | Manual; Điều 35 khoản 3 |
| Đơn vị chuyên trách/vận hành gửi chủ quản | **Trước** 20/12 hằng năm | Manual; Điều 35 khoản 4 điểm a |
| Chủ quản gửi Bộ Công an | **Trước** 25/12 hằng năm | Manual; Điều 35 khoản 4 điểm b |
| Dự án đầu tư/xây dựng trước 01/07/2026 hoàn tất hồ sơ theo NĐ85 | 6 tháng từ hiệu lực Luật116 | Manual, kiểm tra đã đến hạn; Điều 39 khoản 1 |
| Cùng dự án đáp ứng biện pháp/baseline theo NĐ331 | 12 tháng từ hiệu lực Luật116 | Manual, kiểm tra đã đến hạn; Điều 39 khoản 1 |

Không chuyển ngày làm việc thành ngày lịch hoặc tháng thành 30 ngày. Các hạn xử lý hồ sơ là trách nhiệm của bên xử lý theo thẩm quyền; chậm xử lý không tự chứng minh đơn vị vận hành vi phạm. Điều 23 khoản 3 không nêu hạn thẩm định 15/25 ngày cho cấp 1/2. Điều 37 là **khuyến khích** phê duyệt sớm, được ghi `normativeStrength: recommendation`.

Hai fact số giờ:

- `vn.incident.cause_scope_remediation_report_delay_hours`: từ thời điểm phát hiện tới báo cáo cơ quan chuyên trách đúng thẩm quyền; số không âm, tối đa 72.
- `vn.incident.initial_serious_notification_delay_hours`: từ phát hiện sự cố nghiêm trọng tới thông báo ban đầu; số không âm, tối đa 24.

Hai ngưỡng này không thay thế yêu cầu báo cáo **ngay** khi có điều kiện đoạn thứ ba. Một khai báo 24/72 giờ chỉ tạo đối chiếu metadata, không chứng minh báo cáo đã được cơ quan nhận hoặc sự cố được xử lý xong.

## Ý nghĩa của bằng chứng cấu trúc

`applicabilityConfirmed` phải do người có trách nhiệm xác nhận phạm vi và căn cứ áp dụng. Các fact điều kiện là khai báo bối cảnh; thiếu fact giữ `applicability_unknown`, không được mặc định false.

Các boolean mô tả nội dung/phê duyệt/triển khai phải có tham chiếu opaque tới bằng chứng được quản lý, ngày quan sát và hạn hiệu lực; chỉ ghi true sau khi người khai báo đã kiểm tra nội dung tương ứng. Không đưa sơ đồ mạng, IP nội bộ, tên người, dữ liệu liên hệ, hợp đồng, chữ ký, token hay nội dung báo cáo sự cố vào trường fact/ref.

`matches_declared_fact` chỉ cho biết metadata khai báo phù hợp biểu thức điều khoản. Harness không kiểm tra chữ ký/phê duyệt, tính xác thực tài liệu, nội dung file, thực trạng cấu hình hay tư cách tổ chức. Mục manual tiếp tục cần người đánh giá; tất cả kết luận tổng thể vẫn là `not_determined` và coverage một phần.

`evidenceKinds` phản ánh bằng chứng thích hợp cho từng điều khoản. Pack không nhận `scan_metadata` làm bằng chứng cho hồ sơ/kiến trúc/phê duyệt/báo cáo hoặc thời hạn. Một report web không có finding không đáp ứng các điều khoản này. Các chủ đề nhân sự/nhà cung cấp được đặt vào `risk_management` của profile hiện tại, không tạo một số điều luật mới.

## Fact điều kiện và cách khai báo

Tất cả fact dưới đây là boolean. Giá trị `false` cũng cần căn cứ phạm vi/sự kiện. Bối cảnh còn thiếu giữ trạng thái chưa xác định; một lần đánh giá chỉ đại diện cho hệ thống và sự kiện/kỳ được chọn.

| Fact điều kiện | Ý nghĩa |
|---|---|
| `vn.scope.owner_delegated` | Chủ quản có ủy quyền cho tổ chức trực thuộc theo Điều 4 khoản 3. |
| `vn.scope.multiple_operators` | Có nhiều đơn vị vận hành trong hệ thống thành phần/phân tán. |
| `vn.scope.it_service_outsourced` | Có thuê dịch vụ công nghệ thông tin. |
| `vn.scope.service_provider_identified` | Đã xác định nhà cung cấp để áp dụng nhánh hợp đồng tại Điều 5 khoản 3 điểm a. |
| `vn.scope.service_expired_system_continues` | Hết thời hạn cung cấp dịch vụ nhưng hệ thống vẫn hoạt động. |
| `vn.context.first_classification` | Đang xác định cấp độ lần đầu. |
| `vn.context.function_scope_data_technology_changed` | Có thay đổi thuộc Điều 10 khoản 2 điểm b. |
| `vn.context.scale_integration_data_sharing_changed` | Có mở rộng/tích hợp/liên thông/chia sẻ dữ liệu thuộc Điều 10 khoản 2 điểm c. |
| `vn.context.serious_incident_or_high_impact_risk` | Có sự cố nghiêm trọng hoặc nguy cơ cao thuộc Điều 10 khoản 2 điểm d. |
| `vn.context.risk_assessment_authority_request` | Có yêu cầu của cơ quan có thẩm quyền về đánh giá rủi ro. |
| `vn.risk.exceeds_assigned_level` | Người có trách nhiệm đã xác định mức rủi ro vượt cấp độ đang được gán. |
| `vn.scope.article14_2_continuous_service` | Hệ thống thuộc tiêu chí dịch vụ/hạ tầng toàn quốc 24/7 tại Điều 14 khoản 2. |
| `vn.scope.specialist_unit_also_operator` | Đơn vị chuyên trách cũng trực tiếp quản lý/vận hành hệ thống. |
| `vn.context.dossier_received_invalid` | Có mốc nhận hồ sơ chưa hợp lệ cần phản hồi bổ sung. |
| `vn.context.valid_complete_dossier_received` | Có mốc nhận đủ hồ sơ hợp lệ để tính hạn thẩm định. |
| `vn.context.valid_complete_approval_dossier_received` | Có mốc nhận đủ hồ sơ phê duyệt hợp lệ. |
| `vn.context.before_operation` | Đang ở giai đoạn trước đưa hệ thống vào vận hành. |
| `vn.context.major_function_scale_technology_risk_change` | Có thay đổi lớn thuộc Điều 28 khoản 3 điểm b. |
| `vn.context.readiness_authority_request` | Có yêu cầu đánh giá điều kiện an ninh của cơ quan có thẩm quyền. |
| `vn.scope.new_upgraded_or_expanded` | Xây mới, nâng cấp hoặc mở rộng hệ thống. |
| `vn.scope.outsourced_dc_cloud` | Thuê dịch vụ công nghệ thông tin tại trung tâm dữ liệu/điện toán đám mây. |
| `vn.scope.national_critical` | Có căn cứ/hồ sơ thẩm quyền xác định hệ thống quan trọng về an ninh quốc gia; không suy ra từ số finding. |
| `vn.scope.shared_security_solution` | Thiết kế có giải pháp an ninh mạng dùng chung. |
| `vn.context.internal_self_assessment` | Đang dùng hình thức tự đánh giá nội bộ. |
| `vn.incident.detected` | Có sự cố đã được phát hiện, với thời điểm phát hiện được ghi nhận. |
| `vn.incident.serious` | Sự cố được người có trách nhiệm xác định là nghiêm trọng. |
| `vn.incident.immediate_reporting_trigger` | Có dấu hiệu xâm phạm quốc gia/trật tự/an toàn xã hội hoặc gián đoạn nghiêm trọng thuộc Điều 31 khoản 2 điểm d đoạn 3. |
| `vn.incident.complex` | Sự cố phức tạp cần báo cáo sơ bộ, cập nhật và kết thúc theo các giai đoạn. |
| `vn.context.weaknesses_or_vulnerabilities_identified` | Đã phát hiện điểm yếu, lỗ hổng hoặc nguy cơ cần xử lý. |
| `vn.scope.military` | Hệ thống thông tin quân sự; false chỉ khi đã xác minh không thuộc phạm vi này. |
| `vn.scope.government_cipher` | Hệ thống thông tin cơ yếu thuộc Ban Cơ yếu Chính phủ; false phải có căn cứ phạm vi. |
| `vn.context.annual_reporting_period_due` | Đang rà soát một kỳ báo cáo năm có nghĩa vụ gửi báo cáo; không mặc định quá hạn trước tháng 12. |
| `vn.scope.investment_construction_before_2026_07_01` | Đang đầu tư/xây dựng từ trước 01/07/2026 theo Điều 39 khoản 1. |

## Chỉ mục điều khoản trong pack

`framework_wide` biểu diễn điều khoản có phạm vi chung. `explicit_clause` liệt kê các cấp được nêu hoặc các nhánh điều kiện được tách rõ. Không dùng kế thừa ngầm từ cấp thấp lên cấp cao.

| Requirement ID | Cấp độ được liệt kê | Locator nguồn NĐ331 | Kiểu kiểm tra |
|---|---|---|---|
| `vn-n331-single-owner` | 1, 2, 3, 4, 5 | Điều 8 khoản 1 điểm a | boolean |
| `vn-n331-boundary` | 1, 2, 3, 4, 5 | Điều 7 khoản 2 điểm a, b; Điều 8 khoản 3 | manual |
| `vn-n331-highest-level` | 1, 2, 3, 4, 5 | Điều 8 khoản 2; Điều 11–16 | manual |
| `vn-n331-owner-delegation` | 1, 2, 3, 4, 5 | Điều 4 khoản 3 | boolean |
| `vn-n331-lead-operator` | 1, 2, 3, 4, 5 | Điều 5 khoản 2 | boolean |
| `vn-n331-outsourcing-contract` | 1, 2, 3, 4, 5 | Điều 5 khoản 3 điểm a | boolean |
| `vn-n331-expired-service` | 1, 2, 3, 4, 5 | Điều 5 khoản 3 điểm b | boolean |
| `vn-n331-risk-trigger-first` | 1, 2, 3, 4, 5 | Điều 10 khoản 2 điểm a | boolean |
| `vn-n331-risk-trigger-change` | 1, 2, 3, 4, 5 | Điều 10 khoản 2 điểm b | boolean |
| `vn-n331-risk-trigger-connection` | 1, 2, 3, 4, 5 | Điều 10 khoản 2 điểm c | boolean |
| `vn-n331-risk-trigger-incident` | 1, 2, 3, 4, 5 | Điều 10 khoản 2 điểm d | boolean |
| `vn-n331-risk-trigger-request` | 1, 2, 3, 4, 5 | Điều 10 khoản 2 điểm đ | boolean |
| `vn-n331-risk-content-assets` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm a | boolean |
| `vn-n331-risk-content-information` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm b | boolean |
| `vn-n331-risk-content-threats` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm c | boolean |
| `vn-n331-risk-content-impact` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm d | boolean |
| `vn-n331-risk-content-capability` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm đ | boolean |
| `vn-n331-risk-content-mitigation` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm e | boolean |
| `vn-n331-risk-content-communication` | 1, 2, 3, 4, 5 | Điều 10 khoản 3 điểm g | boolean |
| `vn-n331-risk-records` | 1, 2, 3, 4, 5 | Điều 10 khoản 6 | boolean |
| `vn-n331-risk-level-up` | 1, 2, 3, 4, 5 | Điều 10 khoản 5 | boolean |
| `vn-n331-dossier-overview` | 1, 2, 3, 4, 5 | Điều 21 khoản 1; Điều 22 khoản 3 | boolean |
| `vn-n331-dossier-design` | 1, 2, 3, 4, 5 | Điều 21 khoản 2 điểm a, b | manual |
| `vn-n331-dossier-level-rationale` | 1, 2, 3, 4, 5 | Điều 21 khoản 3; Điều 22 khoản 4 | boolean |
| `vn-n331-dossier-security-plan` | 1, 2, 3, 4, 5 | Điều 21 khoản 4 | boolean |
| `vn-n331-dossier-professional-opinion` | 4, 5 | Điều 21 khoản 5 | boolean |
| `vn-n331-dossier-architecture` | 1, 2, 3, 4, 5 | Điều 22 khoản 3 điểm d | boolean |
| `vn-n331-detailed-risk-dependencies` | 4, 5 | Điều 22 khoản 5 điểm a | boolean |
| `vn-n331-detailed-risk-attack-impact` | 4, 5 | Điều 22 khoản 5 điểm b | boolean |
| `vn-n331-detailed-risk-consequences` | 4, 5 | Điều 22 khoản 5 điểm c | boolean |
| `vn-n331-24-7-rationale` | 4, 5 | Điều 22 khoản 5 điểm d; Điều 14 khoản 2 | boolean |
| `vn-n331-control-implementation-plan` | 1, 2, 3, 4, 5 | Điều 22 khoản 6 | boolean |
| `vn-n331-approval-level12` | 1, 2 | Điều 18 khoản 1 | manual |
| `vn-n331-approval-level3` | 3 | Điều 18 khoản 2; Điều 20 khoản 4 | manual |
| `vn-n331-approval-level4` | 4 | Điều 18 khoản 3 điểm a–d; Điều 20 khoản 4 | manual |
| `vn-n331-approval-level5` | 5 | Điều 18 khoản 3 điểm a–đ | manual |
| `vn-n331-appraisal-conflict` | 1, 2, 3, 4, 5 | Điều 18 khoản 4 | manual |
| `vn-n331-invalid-dossier-response` | 1, 2, 3, 4, 5 | Điều 23 khoản 2 | manual |
| `vn-n331-level3-appraisal-time` | 3 | Điều 23 khoản 3 điểm a | manual |
| `vn-n331-level45-appraisal-time` | 4, 5 | Điều 23 khoản 3 điểm b | manual |
| `vn-n331-approval-time` | 1, 2, 3, 4, 5 | Điều 24 khoản 2 | manual |
| `vn-n331-preoperation-readiness` | 1, 2, 3, 4, 5 | Điều 28 khoản 3 điểm a, b | boolean |
| `vn-n331-change-readiness` | 1, 2, 3, 4, 5 | Điều 28 khoản 3 điểm b | boolean |
| `vn-n331-authority-readiness` | 1, 2, 3, 4, 5 | Điều 28 khoản 3 điểm b | boolean |
| `vn-n331-plan-design` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm a | boolean |
| `vn-n331-plan-operation` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm b | boolean |
| `vn-n331-plan-assessment` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm c | boolean |
| `vn-n331-plan-risk` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm d | boolean |
| `vn-n331-plan-monitoring` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm đ | boolean |
| `vn-n331-plan-recovery` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm e | boolean |
| `vn-n331-plan-retirement` | 1, 2, 3, 4, 5 | Điều 29 khoản 2 điểm g | boolean |
| `vn-n331-current-baseline` | 1, 2, 3, 4, 5 | Điều 29 khoản 1; Điều 30 khoản 1; Điều 28 khoản 4 | manual |
| `vn-n331-sharing-considered` | 1, 2, 3 | Điều 30 khoản 5 điểm a | boolean |
| `vn-n331-availability-containment` | 4, 5 | Điều 30 khoản 5 điểm b | boolean |
| `vn-n331-plan-before-operation` | 1, 2, 3, 4, 5 | Điều 30 khoản 6 | boolean |
| `vn-n331-policy-before-dossier` | 1, 2, 3, 4, 5 | Điều 30 khoản 7 | boolean |
| `vn-n331-cloud-l34-systems` | 3, 4 | Điều 30 khoản 8 điểm a | boolean |
| `vn-n331-cloud-l34-zones` | 3, 4 | Điều 30 khoản 8 điểm b | boolean |
| `vn-n331-cloud-l34-storage` | 3, 4 | Điều 30 khoản 8 điểm c | boolean |
| `vn-n331-cloud-l5-systems` | 5 | Điều 30 khoản 9 điểm a | boolean |
| `vn-n331-cloud-critical-systems` | 1, 2, 3, 4 | Điều 30 khoản 9 điểm a | boolean |
| `vn-n331-cloud-l5-zones` | 5 | Điều 30 khoản 9 điểm b | boolean |
| `vn-n331-cloud-critical-zones` | 1, 2, 3, 4 | Điều 30 khoản 9 điểm b | boolean |
| `vn-n331-cloud-l5-storage` | 5 | Điều 30 khoản 9 điểm c | boolean |
| `vn-n331-cloud-critical-storage` | 1, 2, 3, 4 | Điều 30 khoản 9 điểm c | boolean |
| `vn-n331-cloud-l5-core-network` | 5 | Điều 30 khoản 9 điểm d | boolean |
| `vn-n331-cloud-critical-core-network` | 1, 2, 3, 4 | Điều 30 khoản 9 điểm d | boolean |
| `vn-n331-cloud-l5-shared-security` | 5 | Điều 30 khoản 9 điểm đ | boolean |
| `vn-n331-cloud-critical-shared-security` | 1, 2, 3, 4 | Điều 30 khoản 9 điểm đ | boolean |
| `vn-n331-specialist-staff` | 1, 2, 3, 4, 5 | Điều 31 khoản 1 điểm b | boolean |
| `vn-n331-internal-review-independent` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm c, đoạn về tự đánh giá nội bộ | boolean |
| `vn-n331-level5-specialist-review` | 5 | Điều 31 khoản 2 điểm c, đoạn về tổ chức chuyên môn | manual |
| `vn-n331-critical-specialist-review` | 1, 2, 3, 4 | Điều 31 khoản 2 điểm c, đoạn về tổ chức chuyên môn | manual |
| `vn-n331-triggered-specialist-review` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm c, đoạn về tổ chức chuyên môn | manual |
| `vn-n331-incident-report-72h` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm d, đoạn thứ nhất | number |
| `vn-n331-serious-incident-24h` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm d, đoạn thứ hai | number |
| `vn-n331-incident-immediate` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm d, đoạn thứ ba | manual |
| `vn-n331-complex-incident-updates` | 1, 2, 3, 4, 5 | Điều 31 khoản 2 điểm d, đoạn thứ nhất | manual |
| `vn-n331-awareness-drills` | 1, 2, 3, 4, 5 | Điều 31 khoản 3 | manual |
| `vn-n331-continuous-monitoring` | 1, 2, 3, 4, 5 | Điều 28 khoản 5 điểm a | boolean |
| `vn-n331-control-effectiveness` | 1, 2, 3, 4, 5 | Điều 33 khoản 3; Điều 28 khoản 5 điểm a, b | boolean |
| `vn-n331-remediate-weaknesses` | 1, 2, 3, 4, 5 | Điều 33 khoản 4; Điều 28 khoản 5 điểm c | boolean |
| `vn-n331-national-monitoring-cooperation` | 1, 2, 3, 4, 5 | Điều 33 khoản 5 | manual |
| `vn-n331-annual-report-window` | 1, 2, 3, 4, 5 | Điều 35 khoản 3 | manual |
| `vn-n331-annual-report-owner` | 1, 2, 3, 4, 5 | Điều 35 khoản 4 điểm a | manual |
| `vn-n331-annual-report-authority` | 1, 2, 3, 4, 5 | Điều 35 khoản 4 điểm b | manual |
| `vn-n331-annual-report-control-status` | 1, 2, 3, 4, 5 | Điều 36 khoản 5, 9, 10 | boolean |
| `vn-n331-early-project-approval` | 1, 2, 3, 4, 5 | Điều 37 | manual / khuyến khích |
| `vn-n331-construction-transition` | 1, 2, 3, 4, 5 | Điều 39 khoản 1 | manual |

## Phụ lục đã đối chiếu

Phụ lục NĐ331 gồm Mẫu 01–08 cho đề nghị thẩm định/phê duyệt, đề nghị thẩm định, đề nghị ý kiến chuyên môn, ý kiến thẩm định, tờ trình phê duyệt, quyết định cấp độ, quyết định phương án và báo cáo. Mẫu 08 có các cột cấp độ đề xuất, trạng thái hồ sơ/quyết định, quy chế, trạng thái triển khai phương án và kiểm tra đánh giá.

Phụ lục này không phải bảng kỹ thuật MFA, mật khẩu, mã hóa hay thời gian lưu nhật ký. Pack viện dẫn nội dung điều khoản tương ứng; chưa tự động kiểm tra tính đầy đủ/sai sót của các mẫu.

## Phần cần nghiên cứu và bổ sung tiếp

1. **Toàn văn TCVN14423:2026**: danh mục VSQI hiện cung cấp lựa chọn đặt mua, chưa tìm thấy toàn văn miễn phí trên nguồn cơ quan nhà nước trong đợt nghiên cứu. Cần một bản được phép sử dụng, đọc các tiểu mục theo cấp, kiểm tra quan hệ áp dụng với NĐ331 rồi thêm từng locator/check. Không mua hoặc sao chép toàn bộ tiêu chuẩn vào repo.
2. **Quy định Bộ Công an về đánh giá rủi ro** (Điều 10 khoản 8), **giám sát/ứng cứu** (Điều 28 khoản 6), phương pháp/biểu mẫu đánh giá và hướng dẫn kết nối. Chưa xác minh một bộ văn bản đủ để khẳng định đã bao phủ tất cả yêu cầu; không biến việc tìm kiếm chưa ra kết quả thành kết luận chưa ban hành.
3. **QĐ1875/QĐ-TTg và phụ lục**: [thông tin chính thức về phạm vi](https://khcn.gov.vn/tin-tuc/t53325/ban-hanh-khung-kien-truc-an-ninh-mang-quoc-gia) liệt kê cơ quan hệ thống chính trị và các tổ chức cụ thể. Phải đọc toàn văn, phân biệt yêu cầu dùng chung/kết nối/đầu mối/ứng cứu theo phạm vi trước khi mã hóa. Không phổ quát hóa cho mọi website Việt Nam.
4. **Chuyển tiếp và bản hợp nhất**: kiểm tra Luật116 Điều45, lịch sử sửa đổi, hồ sơ NĐ85/TT12 đã phê duyệt và cách tính hạn. Tình trạng hiển thị của một văn bản cũ không tự quyết định hồ sơ hiện tại áp dụng điều khoản nào.
5. **Chuyên ngành, dữ liệu cá nhân, bí mật nhà nước, mật mã và quân sự/cơ yếu**: thêm pack riêng khi có phạm vi rõ và nguồn chính thức đủ; không suy ra từ countryCode.
6. **Xác minh nội dung thật**: bộ kiểm tra chữ ký/quyết định, biên nhận thời gian, sơ đồ/cấu hình phân tách và crosswalk theo chuẩn sẽ cần quy tắc riêng. Chưa được thay kết luận chưa xác định bằng chứng nhận cấp độ hoặc thông báo hoàn toàn an toàn.

## Kiểm tra đã thực hiện

Đã nạp pack qua `validateRequirementPack`, tạo template và chạy `assessClauses` không có bằng chứng cho cả 5 cấp độ. Tất cả trả `not_determined`, không có fact được đánh dấu phù hợp. Số yêu cầu được chọn theo cấp là 69/69/73/78/75; chênh lệch phản ánh nhánh điều kiện và manual, không phải độ mạnh bảo mật hay phần trăm tuân thủ.

