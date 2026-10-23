# Nguồn và thiết kế assurance web

Ngày đối chiếu: **08/10/2026**. Tài liệu này mô tả nguồn đã kiểm tra và đường
phát triển của harness offline. Crosswalk là liên hệ giữa một scenario/chủ đề
với requirement hoặc outcome; mỗi liên hệ phải giữ phiên bản và giới hạn của
nguồn. Cấp độ quốc gia, mức tác động hệ thống, CSF tier và ASVS level có ý nghĩa
khác nhau; không có phép đổi số giữa chúng.

## OWASP ASVS 5.0.0

Nguồn chính thức có JSON/CSV và ID versioned, phù hợp làm catalog requirement
web riêng bên cạnh catalog quốc gia. Pin đã kiểm tra:

- [Release `v5.0.0_release`](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release).
- Commit `5cf9b032440be53ce345ab3c130fda46ba1ce7a2`.
- [JSON tiếng Anh tại commit](https://raw.githubusercontent.com/OWASP/ASVS/5cf9b032440be53ce345ab3c130fda46ba1ce7a2/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json).
- Kích thước JSON: `149407` byte. SHA-256:
  `bcdbec214d70abcfad9284a31d4f9e5134305831d628aad3aa85d7e26626cb35`.
- Đếm trực tiếp JSON: **345 requirement**, **17 chapter**; trường `L` có
  70 entry mức 1, 183 mức 2, 92 mức 3. Đây là số entry theo mức được gắn trong
  nguồn, chưa là số requirement đã kiểm thử hay đạt của OpenHunter.

Một crosswalk chọn lọc có thể dùng các ID v5 đã đối chiếu sau. Các mô tả ngắn
dưới đây là diễn giải của OpenHunter; benchmark chỉ quan sát một phần của
requirement và phải lưu `coverage:"partial"`.

| Lớp/chủ đề web | ASVS ID versioned | `L` | Chủ đề được liên hệ |
| --- | --- | --- | --- |
| XSS | `v5.0.0-1.2.1` | 1 | Encoding phù hợp ngữ cảnh đầu ra |
| SQLi | `v5.0.0-1.2.4` | 1 | Bảo vệ truy vấn dữ liệu khỏi injection |
| IDOR/BOLA | `v5.0.0-8.2.2` | 1 | Quyền truy cập từng đối tượng dữ liệu |
| Authorization | `v5.0.0-8.3.1` | 1 | Thực thi quyền tại dịch vụ đáng tin cậy |
| Function access | `v5.0.0-8.2.1` | 1 | Quyền gọi từng chức năng |
| SSRF | `v5.0.0-1.3.6` | 2 | Kiểm soát đích request của server |
| Cookie transport | `v5.0.0-3.3.1` | 1 | Secure và prefix cookie |
| Cookie/CSRF | `v5.0.0-3.3.2` | 2 | SameSite theo mục đích cookie |

Lưu cả `nativeId:"V8.2.2"` của JSON và ID public versioned để tránh nhầm với
ASVS 4.x. Có một test IDOR qua benchmark chưa chứng minh toàn bộ requirement,
toàn ứng dụng hoặc ASVS level. Các requirement cần cấu hình, thiết kế, code
review hoặc đánh giá tổ chức phải có phương pháp/bằng chứng riêng. OWASP
hướng dẫn tham chiếu theo phiên bản trên [trang ASVS](https://owasp.org/projects/asvs).

ASVS sử dụng [CC BY-SA 4.0](https://raw.githubusercontent.com/OWASP/ASVS/5cf9b032440be53ce345ab3c130fda46ba1ce7a2/LICENSE.md).
Nếu trích dữ liệu/nội dung requirement vào repo, giữ attribution, nguồn,
thông báo thay đổi và giấy phép cho phần dữ liệu đó. Không vendor toàn repo
upstream; cập nhật nguồn và crosswalk theo quy trình enrichment thủ công.

## NIST CSF và SP 800-53B

[CSF 2.0 Reference Tool](https://csrc.nist.gov/Projects/cybersecurity-framework/Filters)
cung cấp Core ở JSON/Excel. Outcome CSF dùng cho profile và liên hệ chủ đề;
tier mô tả độ chặt chẽ quản trị/quản lý rủi ro. Một kết quả web không xác lập
tier tổ chức. NIST mô tả giới hạn của implementation examples và informative
references tại [CSF FAQ](https://www.nist.gov/cyberframework/faqs).

Đã kiểm tra endpoint JSON của frontend:

```text
https://csrc.nist.gov/extensions/nudp/services/json/csf/elements
response.elements: 6 function roots
bytes: 2167408
sha256: 129b5a3f02ed70c9dd565f20f815be90030e64a8c7cb90d33974a26c6084edc5
```

Đây là snapshot online có thêm informative mappings; URL không bất biến.
Khi nhập vào repo chỉ lấy các core ID cần thiết, ghi hash/version/review date
và đánh giá lại thủ công. Endpoint `csf/download?olirids=all` hiện trả XLSX,
không phải JSON mặc dù đường dẫn chứa `/json/`.

[SP 800-53B](https://csrc.nist.gov/pubs/sp/800/53/b/upd1/final) cung cấp baseline
Low/Moderate/High theo tác động cùng baseline privacy; baseline cần tailoring.
Nó khác mức tác động của FIPS 199 và khác tier CSF. Các OSCAL profile nhỏ có thể
dùng làm nguồn control IDs, giữ nguyên scope liên bang và các điều kiện chọn
baseline. Pin repo NIST đã kiểm tra:

```text
repository: https://github.com/usnistgov/oscal-content
commit: 78650f02ad9321bb7b817846f8fbd4f2bcd620de
directory: nist.gov/SP800-53/rev5/json/
```

| Profile JSON tại commit | Số control IDs chọn trong profile | SHA-256 |
| --- | --- | --- |
| `NIST_SP-800-53_rev5_LOW-baseline_profile.json` | 149 | `8fd206017c8d718b44bdef612c2ff321a9fd84d97a515c8ec33c4619accbef6e` |
| `NIST_SP-800-53_rev5_MODERATE-baseline_profile.json` | 287 | `9030dbf1f13169947eb97eb101b4bd2f00d3c151b100455a923ac75803f00ea1` |
| `NIST_SP-800-53_rev5_HIGH-baseline_profile.json` | 370 | `60576970caef91b2cba56d46e5948b72e3b879434fc2a4840bc4179e5e75cfd7` |

Metadata version của các profile là `5.2.0`. HIGH title vẫn ghi `5.1.1`; đây
là bất nhất nguồn cần ghi nhận trước khi mở rộng catalog, không tự sửa thành
claim đã xác minh. [Profile LOW đã pin](https://raw.githubusercontent.com/usnistgov/oscal-content/78650f02ad9321bb7b817846f8fbd4f2bcd620de/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json)
là ví dụ cấu trúc OSCAL. Cần resolve tham chiếu catalog từ cùng commit để tránh
chọn IDs theo một version rồi lấy nội dung từ version khác.

## Đo năng lực web sâu hơn

Mỗi lớp cần case dương/âm ghép cặp, phạm vi, điều kiện ban đầu và oracle đã
được người đánh giá kiểm tra. Bộ lớp có thể mở rộng theo khả năng thực thi thực:

| Nhóm | Oracle đo được trong môi trường được phép | Coverage cần giữ |
| --- | --- | --- |
| Injection | Marker browser, truy vấn trả khác biệt có control | Encoding/truy vấn chưa review vẫn chưa đủ |
| Object/function authorization | So sánh account/role và quyết định quyền trên cùng object | Test account/action nhạy cảm qua approval |
| Session/authentication | Vòng đời session, cookie flags, quyết định xác thực | Không brute force/credential stuffing |
| CORS/CSRF | Quyết định origin và yêu cầu anti-CSRF trong scenario hẹp | Không suy từ header thành tác động đã chứng minh |
| Transport/configuration | Header/cấu hình được quan sát theo host/path | Không suy luận toàn bộ hạ tầng |
| File handling | Chấp nhận/từ chối fixture và giới hạn cấu hình | Upload/mutation phải qua approval |
| SSRF/path handling | Oracle canary cô lập có giới hạn | Không gọi private/metadata/out-of-scope target |

Benchmark cần tính recall, FP, coverage và evidence completeness trên toàn
ground truth, gồm case thiếu/skipped/inconclusive. Ghi rõ snapshot của manifest,
run và oracle; không nâng điểm bằng cách bỏ case khó. Chỉ thêm lớp vào gate sau
khi có oracle và executor tương ứng được kiểm tra. Các lớp chỉ có mapping được
hiển thị là planned/unsupported. ASVS/CSF crosswalk không mở rộng authorization,
Deep hoặc policy gate của engine.

## Artifact verifier hiện được triển khai

[artifact-verifier.mjs](../artifact-verifier.mjs) tiến xa hơn kiểm tra chuỗi ref:
nó đọc file JSON giới hạn 64 KiB trong thư mục operator chỉ định, kiểm tra
SHA-256 byte thực, Ed25519 và trust store public key cung cấp riêng. Artifact
là summary enum, không chứa raw request/response, URL, body, credential hoặc
free text. Manifest/trust file giới hạn 1 MiB; bundle tối đa 512 artifact.

Manifest và mọi artifact được ký đều bắt buộc:

```text
dataOrigin, assessmentId, runId, frameworkId, levelId, producerId
benchmarkManifestSHA256, benchmarkRunSHA256
artifactId, caseId, role
```

Hai benchmark digest phải là SHA-256 của `canonicalJsonBytes` trên toàn bộ
manifest/run tương ứng. Wrapper cần so sánh hai digest với input thực trước
khi dùng attestation; chỉ so sánh tên case không ngăn việc đổi ground truth
hoặc thresholds. File basename phải đúng `<artifactId>.json`. Duplicate ID,
file, hash và role trong một case bị từ chối; không tái sử dụng proof cho
case khác. Symlink/hardlink và thay đổi file identity trong lúc đọc bị chặn.

Artifact còn ràng buộc `validatorId`, `keyId`, `observedAt`, `expiresAt`.
Key phải active, đúng validator, đúng nguồn dữ liệu và khoảng hiệu lực.
Producer ID phải khác validator ID. Trust store là cấu hình operator kiểm soát
ngoài dữ liệu engine gửi; public key trong artifact không thiết lập trust.
Validator labels khác nhau chưa chứng minh độc lập tổ chức/process: người
vận hành phải quản lý và đối chiếu key fingerprint riêng. Không dùng trust
synthetic để xác nhận operator run.

Chữ ký dùng `crypto.sign/verify` Ed25519 với algorithm `null`; signing bytes
là prefix domain cố định rồi JSON sắp key, bỏ duy nhất trường `signature`.
File hash vẫn bao gồm toàn bộ byte file/chữ ký. Xem [Node crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoverifyalgorithm-data-key-signature).

```powershell
node tools/country-security-harness/artifact-verifier.mjs `
  artifact-bundle.json validator-trust.json .\sanitized-artifacts `
  --as-of 2026-10-08
node --test tools/country-security-harness/artifact-verifier.test.mjs
```

Exit 0 nghĩa là tất cả attestation trong bundle đã được kiểm tra trong scope
này; exit 1 là artifact gap; exit 2 là input/config sai. Output chỉ gồm binding
IDs, digest, enum và trạng thái. Nó giữ `replayVerified:false`,
`engineEfficacyVerified:false`, `conclusion:"not_determined"` kể cả có role
`replay`: role đó là lời xác nhận được ký, chưa là replay do harness quan sát.
Không thay đổi metadata-only triage trong `backend/findings/src/validation.ts`,
không ghi finding mới và không xác lập cấp độ pháp lý/chứng nhận.

Việc kiểm tra semantic evidence, baseline/exploit thực, negative controls và
retest vẫn cần executor/validator độc lập trong môi trường được phép theo
gate #14/#22. Trust và chữ ký bổ sung provenance; chúng không tự chứng minh
tính đúng của assertion đã ký.
