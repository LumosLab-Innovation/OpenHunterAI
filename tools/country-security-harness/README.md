# Harness an toàn thông tin đa quốc gia

Harness offline để tra cứu khung/cấp độ bản địa, đối chiếu các điều khoản được
tuyển chọn với dữ kiện khai báo, thiết kế/chấm benchmark web và xác minh
artifact đã sanitize bằng SHA-256/Ed25519. Chạy với Node.js >=22, không cần cài
package, API key, model, Docker hoặc database.

## Phạm vi toàn cầu

Phiên bản `2026-10-08.3`, research nguồn chính thức ngày 08/10/2026:

- **65 quốc gia/vùng lãnh thổ, 75 khung**, gồm châu Á–Thái Bình Dương,
  Trung Đông, châu Âu, châu Mỹ và châu Phi.
- **43 quốc gia/vùng có pack điều khoản**; **22** mới có tham chiếu framework.
  Tổng **45 pack, 926 mục yêu cầu tuyển chọn**; EU và chuẩn quốc tế có nhãn
  riêng và không được cộng vào số quốc gia.
- Directory **248** đơn vị thống kê từ [UN M49](https://unstats.un.org/unsd/methodology/M49).
  Đây là bảng theo dõi research; 184 entry còn pending, không được coi là
  checklist đã hoàn thành. Taiwan trong catalog có gap ngoài snapshot UN.

[Bảng toàn cầu và nguồn từng nước](research/GLOBAL.md) ghi độ sâu và giới hạn.
Ledger chi tiết: [APAC/Trung Đông](expansion/apac-middle-east.research.md),
[Europe/EU](expansion/europe.research.md), [Americas/Africa](expansion/americas-africa.research.md),
[Nam Á](expansion/south-asia.research.md), [quốc tế](expansion/international.research.md).
Mỗi entry có edition, scope, nguồn, loại cấp độ và currency. Khung/pack chưa
research đủ trả `unsupported`; nguồn cần đối chiếu tiếp giữ `requires_review`.

```powershell
node tools/country-security-harness/world-coverage.mjs summary
node tools/country-security-harness/world-coverage.mjs list
node tools/country-security-harness/world-coverage.mjs show VN
node tools/country-security-harness/world-coverage.mjs show EU
node tools/country-security-harness/world-coverage.mjs show AFG
```

`world-coverage.mjs directory` trả cả entry pending. `show` nhận mã trong
catalog hoặc alpha-3 của directory. Inventory chỉ mô tả nghiên cứu, không
tạo assessment cho entry pending. `world-coverage.schema.json` mô tả
directory, identity crosswalk, batch framework và output. Loader clause tự
nạp các file `FRAMEWORK_ID.requirements.json`, kiểm tra trùng ID, framework,
tên file và contract; không còn danh sách cứng ba pack.

## Các khung bản địa ban đầu

Mười khung bên dưới được giữ cùng các entry đa quốc gia mới trong catalog.

| Nước | Framework ID | Cấp độ gốc | Ý nghĩa |
| --- | --- | --- | --- |
| Việt Nam | `vn-system-levels` | `level-1` … `level-5` | Phân cấp hệ thống theo tác động/yêu cầu bảo vệ |
| Trung Quốc | `cn-mlps` | `level-1` … `level-5` | MLPS; phân cấp đối tượng bảo vệ |
| Hoa Kỳ | `us-fips-199` | `low`, `moderate`, `high` | Tác động đối với bảo mật, toàn vẹn, sẵn sàng |
| Hoa Kỳ | `us-nist-csf` | `partial`, `risk-informed`, `repeatable`, `adaptive` | Mức độ chặt chẽ của quản trị/quản lý rủi ro |
| Vương quốc Anh | `gb-cyber-essentials` | `essentials`, `essentials-plus` | Chứng nhận; Plus bổ sung kiểm thử độc lập |
| Singapore | `sg-cyber-trust` | `supporter`, `practitioner`, `promoter`, `performer`, `advocate` | Tier preparedness/chứng nhận tổ chức |
| Australia | `au-essential-eight` | `level-0` … `level-3` | Mức trưởng thành triển khai tám chiến lược |
| Đức | `de-protection-needs` | `normal`, `high`, `very-high` | Nhu cầu bảo vệ theo thiệt hại dự kiến |
| Đức | `de-grundschutz-approaches` | `basis`, `kern`, `standard` | Cách triển khai; không có thứ tự cao/thấp |
| Nhật Bản | `jp-security-action` | `one-star`, `two-star` | Tự tuyên bố cho doanh nghiệp nhỏ/vừa |

Các cấp độ được giữ nguyên theo từng khung. Không có phép quy đổi “Việt Nam
cấp 3 = FIPS High = Essential Eight 3”, điểm xếp hạng quốc gia hoặc điểm an toàn
chung. CSF tiers là mức quản trị rủi ro; FIPS là mức tác động; CE/Plus là bảo đảm
chứng nhận. Việc xác nhận phạm vi áp dụng và lựa chọn cấp độ là trách nhiệm của
chủ quản/người đánh giá.

Việt Nam dùng [Luật 116/2025/QH15, Điều 8, 44–45](https://congbao.chinhphu.vn/van-ban/luat-so-116-2025-qh15-468678/61574.htm)
và [Nghị định 331/2026/NĐ-CP, Điều 8, 11–15, 38–39](https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-331-2026-nd-cp-470334.htm).
Nguồn Nghị định 85/2016 được giữ để đối chiếu các trường hợp chuyển tiếp.
Các pack bên dưới bổ sung điều khoản theo cấp; chưa mã hóa toàn bộ điều kiện/
ngưỡng pháp lý hoặc mọi yêu cầu theo cấp.
`reviewed_reference` nghĩa là đã đối chiếu nguồn ghi trong catalog, không xác
nhận rằng không còn quy định ngành hay văn bản sửa đổi khác áp dụng.

## Checklist điều khoản theo cấp độ

[clauses.schema.json](clauses.schema.json) và [clauses.mjs](clauses.mjs) có
**926 mục yêu cầu tuyển chọn trong 45 pack**, mỗi mục có điều/khoản hoặc mục/trang nguồn,
cấp độ áp dụng, điều kiện phạm vi, loại bằng chứng, phép kiểm tra và diễn giải.
IDs là mã nội bộ của OpenHunter; một khoản có thể tách nhiều mục hoặc nhánh
điều kiện. Số mục không phải số điều luật hay số kiểm soát đã được chứng minh.

Ba pack ban đầu được giữ nguyên trong đợt mở rộng:

| Pack | Mục tuyển chọn | Nội dung bổ sung |
| --- | ---: | --- |
| [Việt Nam](packs/vn-system-levels.requirements.json) | 89 | Hồ sơ, rủi ro, phê duyệt, cloud/DC theo cấp 3/4/5, báo cáo sự cố, chuyển tiếp |
| [Australia](packs/au-essential-eight.requirements.json) | 40 | Hạn vá theo loại ứng dụng, MFA, quyền quản trị, allowlisting, hardening, restore |
| [Anh](packs/gb-cyber-essentials.requirements.json) | 39 | Firewall, thiết bị, vá theo severity, MFA/cloud, mật khẩu, malware, Plus review |

Việt Nam có nguồn metadata [TCVN 14423:2026](https://tieuchuan.vsqi.gov.vn/tieuchuan/view?sohieu=TCVN+14423%3A2026),
thay TCVN 14423:2025 và TCVN 11930:2017. **Chưa tiếp cận toàn văn** nên các
tiểu mục kỹ thuật của tiêu chuẩn này vẫn là gap; không dùng bản đã bị thay
thế làm baseline hiện hành. [Nghiên cứu Việt Nam](research/VN.md) ghi phạm vi,
thời hạn, chuyển tiếp, điều kiện và locator. [Nghiên cứu AU/GB](research/AU-GB.md)
ghi các khác biệt theo cấp, MUST/SHOULD và phạm vi còn thiếu.
[Bảng toàn cầu](research/GLOBAL.md) liệt kê các pack mới và framework chưa có
pack. Các nguồn không định nghĩa cấp dùng `baseline` làm mục tiêu đánh giá,
không tạo cấp quốc gia mới; ASVS giữ native levels 1–3 và Uruguay giữ 0–4.

```powershell
node tools/country-security-harness/clauses.mjs validate-packs
node tools/country-security-harness/clauses.mjs list
node tools/country-security-harness/clauses.mjs show vn-system-levels level-3
```

Tạo evidence theo pack và cấp độ đã chọn:

```powershell
node tools/country-security-harness/clauses.mjs template vn-system-levels level-3 |
  Set-Content -Encoding utf8 vn-clauses.json
node tools/country-security-harness/clauses.mjs assess vn-clauses.json --as-of 2026-10-08
node tools/country-security-harness/clauses.mjs assess tools/country-security-harness/examples/vn-level-3.clauses.json --as-of 2026-10-08
```

Template chụp `packVersion` và SHA-256 của pack; pack đổi nội dung sẽ trả
`PACK_SNAPSHOT_MISMATCH`, yêu cầu tạo/review evidence theo phiên bản mới.
`context` chỉ chứa dữ kiện điều kiện áp dụng; bỏ trống sẽ là
`applicability_unknown`, không mặc định false. `observations` chứa `factId`,
boolean/số/enum, kind, refs và ngày. Xem lệnh `show` để biết fact cần nhập.
Ví dụ trong `examples/*.clauses.json` đều là `synthetic_fixture`.

Kiểm tra máy chỉ cho `matches_declared_fact` hoặc `violates_declared_fact`:
khớp số/boolean không xác minh nội dung tài liệu hay cấu hình thực tế. Điều
khoản phức tạp giữ `manual_review_required`; loại trừ giữ gap cần review.
Bằng chứng thiếu, sai loại, hết hạn hoặc thuộc tương lai không được tính khớp.
Recommendation được đếm riêng với mandatory. Essential Eight level 0 có gap
vì không có baseline được tuyển chọn; không có pass rỗng.
Nguồn có `currency: requires_review` luôn giữ `FRAMEWORK_REVIEW_REQUIRED`,
kể cả khi dữ kiện khai báo khớp. Output giữ loại framework, loại jurisdiction
và trạng thái nguồn để người đánh giá không bỏ qua khác biệt về scope.

Thời hạn giữ đúng đơn vị nguồn: 48 giờ khác 14 ngày, một tháng không đổi thành
30 ngày; ngày làm việc và mốc pháp lý phức tạp cần người review. Ngày `asOf`
chỉ kiểm tra tuổi bằng chứng; không phải bộ giải quyết hiệu lực/chuyển tiếp
pháp luật tại bất kỳ ngày lịch sử nào. Mọi kết quả vẫn `not_determined`,
`formalLevelDetermination:false`, `contentVerified:false`.

## ASVS và thiết kế benchmark mở rộng

[web-assurance.json](web-assurance.json) chụp **345 IDs và mức tối thiểu** của
[OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release),
pin commit/hash nguồn. Crosswalk tuyển chọn **8 requirements** cho XSS,
SQLi và authorization. Không có finding không tự đáp ứng requirement.

```powershell
node tools/country-security-harness/web-assurance.mjs plan level-3
node tools/country-security-harness/web-assurance.mjs manifest |
  Set-Content -Encoding utf8 expanded-manifest.json
```

Kế hoạch có **10 cặp dương/âm, 20 cases**: XSS trong HTML/attribute/script,
stored/DOM; SQLi query/normalization; IDOR theo owner/role/tenant. Mỗi tình huống
ghi mục tiêu review, evidence roles và retest states; đây là thiết kế chưa
chạy. File manifest có sẵn tại `examples/web-benchmark.expanded-manifest.json`.

ASVS target L1/L2/L3 có mẫu số 70/253/345 yêu cầu, gồm các mức tối thiểu thấp
hơn. Output liệt kê tất cả IDs chưa ánh xạ; 8 mapped requirements không thể
trở thành coverage đầy đủ. [Nghiên cứu assurance](research/WEB-ASSURANCE.md)
bổ sung nguồn CSF Core/OSCAL, khác biệt baseline/tier và các nhóm scenario còn
cần executor/oracle. [Thông báo nguồn](research/THIRD-PARTY-NOTICES.md) ghi
attribution và phạm vi dữ liệu được nhập thủ công.
Ledger [source-lock.json](research/source-lock.json) giữ các byte pin đã có
và đánh dấu nguồn chỉ đọc text/metadata; không tạo hash giả cho PDF chưa tải.

## Xác minh artifact và chữ ký validator

[artifact-verifier.mjs](artifact-verifier.mjs) đọc JSON đã sanitize dưới một
thư mục rõ ràng, tối đa 64 KiB/file và 512 files/bundle. Nó kiểm SHA-256 byte
thật, chữ ký Ed25519, key active/còn hạn, producer khác validator, binding
assessment/run/framework/level/case/role, hai digest benchmark và tuổi proof.
Path traversal, symlink/hardlink, proof tái sử dụng và trường ngoài contract
bị chặn. Output không chứa body, chữ ký hoặc public/private key.

Trust store theo [artifacts.schema.json](artifacts.schema.json) được operator
quản lý riêng, gồm khóa công khai và fingerprint đã đối chiếu ngoài dữ liệu
engine gửi. Đưa public key vào artifact không thiết lập trust. Thay tên
validator không chứng minh độc lập tổ chức/process; operator phải quản lý
quyền sở hữu khóa. Trust có nguồn `synthetic_fixture` không xác nhận run thật.

```powershell
node tools/country-security-harness/artifact-verifier.mjs artifact-bundle.json validator-trust.json .\sanitized-artifacts --as-of 2026-10-08
node tools/country-security-harness/verified-benchmark.mjs benchmark-manifest.json benchmark-run.json artifact-bundle.json validator-trust.json .\sanitized-artifacts --as-of 2026-10-08
```

[verified-benchmark.mjs](verified-benchmark.mjs) liên kết metadata score với
proof ký đúng case/role/validator/outcome. SHA-256 của toàn bộ manifest và run
được tính bằng `canonicalJsonBytes` export trong verifier; thay case, ngưỡng
hoặc kết quả sẽ làm binding thất bại. `canonicalArtifactBytes` thêm domain
prefix và bỏ trường chữ ký; file digest vẫn bao gồm chữ ký và mọi byte.
Output tuân theo [verified-benchmark.schema.json](verified-benchmark.schema.json).

Exit 0 là gate attestation đạt, exit 1 là gate chưa đạt, exit 2 là input sai.
`artifactIntegrityVerified` và `validatorAttestationVerified` có thể true;
chúng xác nhận byte và lời khai của key được tin cậy. **Không có probe/replay
được harness thực thi**: luôn giữ `replayVerified:false` và
`engineEfficacyVerified:false`. Test tạo/chấm 24 artifact được ký thật trong
thư mục tạm, gắn nguồn synthetic; không lưu private key. Core finding/scan
pipeline vẫn dùng các gate độc lập hiện có.

## Tra cứu và tạo mẫu bằng chứng theo chủ đề

Chạy từ thư mục gốc repo:

```powershell
node tools/country-security-harness/harness.mjs validate-catalog
node tools/country-security-harness/harness.mjs list
node tools/country-security-harness/harness.mjs list VN
node tools/country-security-harness/harness.mjs template VN vn-system-levels level-3 |
  Set-Content -Encoding utf8 vn-evidence.json
```

Mẫu mặc định `applicabilityConfirmed:false`, tất cả chủ đề `not_assessed`.
Sau khi người phụ trách xác nhận khung/phạm vi áp dụng, sửa file bằng metadata
đã được kiểm tra, rồi chạy:

```powershell
node tools/country-security-harness/harness.mjs assess vn-evidence.json --as-of 2026-10-08
```

Ngày `--as-of` quyết định việc bằng chứng còn hạn hay đã hết hạn; nếu bỏ qua sẽ
dùng ngày UTC của máy chạy. Tùy chọn này không chứng minh hiệu lực pháp lý của
nguồn tại ngày được chọn. CLI nhận JSON UTF-8 có hoặc không có BOM.

Input tuân theo [evidence.schema.json](evidence.schema.json). Chỉ nhận IDs,
enum, loại bằng chứng, ngày quan sát/hết hạn và tham chiếu artifact dạng opaque.
Không đưa password, token, cookie, dữ liệu cá nhân, URL/path artifact, raw
request/response hoặc nội dung tài liệu vào file. Trường lạ bị từ chối; lỗi CLI
chỉ chứa mã cố định. Tham chiếu bằng chứng phải riêng cho từng chủ đề; không
tái sử dụng cùng ID để tự động lấp nhiều chủ đề.

Các trạng thái đầu vào:

- `reported_satisfied`: người đánh giá báo đáp ứng chủ đề, kèm metadata.
- `reported_failed`: người đánh giá báo chủ đề có vấn đề, kèm metadata.
- `not_assessed`: chưa có bằng chứng phù hợp.
- `not_applicable`: khai báo loại trừ với reason code; vẫn xuất hiện như gap.

`metadataEvidenceAccepted:true` chỉ cho biết metadata đúng định dạng, loại
cho phép và còn hạn. Lệnh `harness.mjs assess` không đọc artifact, xác minh chữ ký/hash, chứng
thực người đánh giá hay thẩm định nội dung. Bằng chứng hết hạn hoặc có ngày
quan sát tương lai bị chuyển thành `not_assessed`. Scan metadata không được
dùng cho quản trị, phân loại hệ thống hay các kiểm soát endpoint chỉ chấp nhận
cấu hình/tài liệu/đánh giá độc lập.

Output [country_security_assessment_v1](assessment.schema.json) luôn có
`conclusion:"not_determined"`, `formalLevelDetermination:false`, cấp độ do
operator lựa chọn và gaps. `controlIds` là **chủ đề rà soát một phần của
OpenHunter**; `mappedControlCount` đếm các chủ đề đó. Đây chưa là checklist
tuân thủ pháp luật theo từng clause/cấp độ hay kết quả cấp chứng nhận.

## Nhập báo cáo OpenHunter

Importer chuyển phần phù hợp của `report_v2` thành evidence template offline:

```powershell
node tools/country-security-harness/import-report.mjs report.json VN vn-system-levels level-3 --observed-on 2026-10-08 --expires-on 2026-11-08 |
  Set-Content -Encoding utf8 imported-evidence.json
node tools/country-security-harness/harness.mjs assess imported-evidence.json --as-of 2026-10-08
```

Chấp nhận report content hoặc API envelope `report.snapshot.content`. Chỉ
finding có trạng thái `validated`, proof đánh dấu sanitized và tham chiếu
opaque hợp lệ được ánh xạ vào `reported_failed`: XSS/SQLi tới
`application_security`, IDOR/object ownership tới `identity_access`. Đây vẫn
là metadata khai báo trong report. Mọi chủ đề khác giữ `not_assessed`;
báo cáo không có finding không tạo `reported_satisfied`. Candidate, alert,
giả thuyết và `legacy_unverified` không được nâng thành kết quả kiểm chứng.
Importer giữ `applicabilityConfirmed:false` để chủ quản xác nhận sau. Nếu báo
cáo hoặc envelope ghi `dataOrigin:"synthetic_fixture"`, cờ tổng hợp được giữ
trong evidence; không chuyển dữ liệu fixture thành bằng chứng thật.

## Benchmark metadata năng lực pentest

[benchmark.schema.json](benchmark.schema.json) mô tả manifest, run và score
của `benchmark.mjs`; gate attestation dùng `verified-benchmark.mjs` ở trên.
Manifest cần tối thiểu một cặp dương/âm cho **mỗi** lớp XSS, SQLi, IDOR; cặp
có cùng `pairId`, category và controlId. `run.results` chứa ID case và kết quả
đã khai báo, không chứa payload, endpoint hoặc credential.

Ví dụ hoàn toàn tổng hợp, được gắn `synthetic_fixture`:

```powershell
node tools/country-security-harness/benchmark.mjs tools/country-security-harness/examples/web-benchmark.manifest.json tools/country-security-harness/examples/web-benchmark.synthetic-run.json
node tools/country-security-harness/benchmark.mjs tools/country-security-harness/examples/web-benchmark.manifest.json tools/country-security-harness/examples/web-benchmark.incomplete-run.json
```

Lệnh đầu phải exit 0 cho gate metadata; lệnh sau phải exit 1 vì thiếu bằng
chứng/kết quả. Input sai trả exit 2. Chấm theo toàn bộ ground truth, gồm case
thiếu/skipped/inconclusive. Không lấy số case thực hiện làm mẫu số để nâng
recall. Gate áp dụng cả tổng thể và từng lớp, gồm recall, false-positive rate,
evidence completeness và execution coverage.

`detected` cần tham chiếu baseline/probe/impact/replay và validator ID khác
producer ID. `clear` cần baseline/probe/negative/replay và validator khác.
Các artifact phải riêng biệt; không được dùng một proof cho nhiều case.
Detection ở mẫu âm luôn tính false positive, kể cả thiếu proof. Case không
thực hiện, thiếu metadata hoặc có coverage gap không thể trở thành clean pass.

Kết quả chỉ có `metadataGatePassed`; luôn giữ `replayVerified:false`,
`engineEfficacyVerified:false`, `assessmentConclusion:"not_determined"`.
Fixture tổng hợp qua gate không chứng minh engine phát hiện lỗ hổng thực tế.
Run bên ngoài phải đổi `dataOrigin` sang `operator_supplied` và được đối chiếu
bằng artifact/replay thật ngoài harness. Gate hiệu quả engine #14/#22 vẫn cần
lab cô lập, matched negative controls, replay độc lập và retest. Benchmark này
không bật executor hoặc thực hiện scan.

Mapping benchmark chỉ áp dụng khi khung có chủ đề web tương ứng. Ví dụ
Essential Eight là kiểm soát môi trường IT/endpoint; chọn nó cho manifest web
này sẽ trả `UNMAPPED_CONTROL`.

## Kiểm thử và thêm khung

```powershell
node --test tools/country-security-harness/harness.test.mjs tools/country-security-harness/benchmark.test.mjs tools/country-security-harness/import-report.test.mjs tools/country-security-harness/catalog.test.mjs tools/country-security-harness/clauses.test.mjs tools/country-security-harness/web-assurance.test.mjs tools/country-security-harness/artifact-verifier.test.mjs tools/country-security-harness/verified-benchmark.test.mjs tools/country-security-harness/world-coverage.test.mjs
```

[Workflow CI](../../.github/workflows/country-security-harness.yml) được cấu hình
chạy trên Ubuntu và Windows với Node 22. QA schema dùng Python 3.12 và
`jsonschema==4.26.0`; kiểm tra dữ liệu/output vẫn offline sau bước cài dependency.
Không cần truy cập target thật hoặc quota LLM. QA schema local:

```powershell
python -m pip install jsonschema==4.26.0
python tools/country-security-harness/validate-schemas.py
```

QA schema kiểm tra tất cả pack/batch, ví dụ và template/assessment của mọi
native target; runtime harness chỉ cần Node và không cần Python.

Để thêm nước/khung: đối chiếu nguồn chính thức và phiên bản, thêm entry vào
[catalog.json](catalog.json), phân biệt loại cấp độ và phạm vi áp dụng, ghi rõ
coverage ánh xạ, tăng `catalogVersion`/`reviewedOn`, thêm kiểm thử nguồn và
native levels. Đặt `currency:"requires_review"` nếu nguồn/phiên bản còn cần
xác minh. Thêm identity join trong `jurisdiction-identifiers.json` cho quốc gia
mới và file `packs/FRAMEWORK_ID.requirements.json` khi đã đọc điều khoản.
Giữ sources, scope, normative strength, native membership và hạn chế cụ thể.
Nhóm EU/ZZ bắt buộc khai báo `supranational`/`international` để không tăng
country count. Các cách triển khai không có thứ tự dùng `ordinalLevels:false`.
Không đồng bộ luật tự động hoặc suy diễn cấp độ cho nước chưa hỗ trợ.

Harness là công cụ offline bên cạnh pipeline `scan_request_v2`/`report_v2`.
Chọn quốc gia/cấp độ không cấp quyền scan, đổi profile, mở Deep hoặc thay đổi
finding trong hệ thống. Mọi kiểm thử thật vẫn theo authorization, scope,
approval, budget và quy tắc dữ liệu hiện có.
