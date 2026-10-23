# Nghiên cứu và phạm vi toàn cầu

Ngày đối chiếu: 2026-10-08. Catalog `2026-10-08.3`. Bảng được tổng hợp từ catalog và pack đang có trong repo; chạy `world-coverage.mjs summary` để kiểm tra lại số hiện tại.

## Phạm vi đã bổ sung

- **65 quốc gia/vùng lãnh thổ** có nguồn chính thức; **43** có pack điều khoản tuyển chọn, **22** mới có tham chiếu framework.
- **75 framework, 45 pack, 926 mục yêu cầu tuyển chọn**. Một khoản có thể tách nhiều nhánh; số mục không phải số điều luật hoặc số kiểm soát đã được chứng minh.
- EU (`supranational`) và nhóm chuẩn quốc tế ZZ (`international`) có nhãn riêng; không được cộng vào số quốc gia/vùng lãnh thổ.
- Directory: **248** đơn vị thống kê theo [UN Statistics Division M49](https://unstats.un.org/unsd/methodology/M49). **184** entry còn `research_pending`. Taiwan được giữ riêng trong catalog và không gán một M49 không có trong snapshot.
- Toàn bộ pack là `partial`. Chưa xác định tuân thủ pháp lý, chứng nhận, cấp độ đạt được hoặc hiệu quả pentest từ các checklist này.

## Cách research và diễn giải

1. Ưu tiên toàn văn do cơ quan ban hành/regulator công bố; lưu URL, edition và điều/khoản hoặc trang. Cần đọc toàn văn để tạo pack; nguồn overview, draft, PDF lỗi hoặc có phí không được dùng để suy ra kiểm tra chi tiết.
2. Giữ phạm vi từng ngành, loại tổ chức, định nghĩa dữ liệu, designation, ngoại lệ, thời điểm và nghĩa vụ theo nguồn. Một framework ngân hàng không trở thành baseline của mọi website trong nước.
3. Giữ native levels khi có nguồn. `baseline` chỉ là mục tiêu đánh giá cho các nguồn không định nghĩa cấp; không tạo một thang cấp quốc gia mới.
4. Tách MUST/SHALL và SHOULD, native impact levels, maturity, certification assurance, self-declaration, regulatory requirements và application verification. Không dùng chỉ số sẵn sàng quốc gia làm cấp an toàn của hệ thống.
5. Khớp dữ kiện chỉ là kết quả khai báo; evidence refs không tự chứng minh nội dung. Các điều kiện phức tạp, mức tối thiểu, ngày làm việc, alternative controls và lịch chuyển tiếp cần manual review.
6. `requires_review` giữ gap trong assessment; `reviewed_reference` chỉ xác nhận nguồn/version đã đối chiếu, không xác nhận đã bao quát mọi sửa đổi hay quy định ngành. Snapshot SHA-256 của từng pack chống đổi cách diễn giải evidence cũ.
7. Ledger khu vực ghi nguồn và giới hạn cụ thể. Inventory giữ riêng `sources` của framework và `packSources` của điều khoản để không mất provenance khi một pack dùng thêm nguồn.

## Kết quả theo khu vực

| Khu vực | Quốc gia/vùng có nguồn | Có pack | Mục yêu cầu |
| --- | ---: | ---: | ---: |
| Châu Á và Thái Bình Dương | 17 | 13 | 332 |
| Trung Đông | 6 | 4 | 69 |
| Châu Âu | 21 | 12 | 268 |
| Châu Mỹ | 12 | 8 | 122 |
| Châu Phi | 9 | 6 | 79 |

EU và chuẩn quốc tế có thêm 56 mục tuyển chọn (NIS2 19, ASVS 37); không phân bổ các mục này vào số quốc gia hoặc tuyên bố mọi nước đã transpose NIS2.

## Bảng nguồn và độ sâu

Cột “có pack” vẫn là tuyển chọn một phần. Không có pack nghĩa là chưa có điều khoản chi tiết để đánh giá, kể cả khi đã có tên framework/cấp độ.

### Châu Á và Thái Bình Dương

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| AU | Australia | 1 | 1 | 40 | [au-essential-eight](https://www.cyber.gov.au/publication/essential-eight-maturity-model) |
| BD | Bangladesh | 1 | 1 | 18 | [bd-bb-ict-security](https://www.bb.org.bd/aboutus/regulationguideline/brpd/jun192023_ictsecurityv4.pdf) |
| CN | Trung Quốc | 2 | 1 | 16 | [cn-mlps](https://www.miit.gov.cn/jgsj/xxjsfzs/xxgk/art/2020/art_a981907528694176a61b5b52c2d19895.html), [cn-data-security-law-2021](https://www.cac.gov.cn/2021-06/11/c_1624994566919140.htm) |
| HK | Hong Kong SAR | 1 | 1 | 16 | [hk-s17-2025](https://www.govcert.gov.hk/doc/S17_EN.pdf) |
| ID | Indonesia | 1 | 0 | 0 | [id-ojk-cyber-2022](https://ojk.go.id/id/regulasi/Documents/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum/SEOJK%2029%20SEOJK.03%202022.pdf) |
| IN | India | 1 | 0 | 0 | [in-cert-directions-2022](https://www.cert-in.org.in/Directions70B.jsp) |
| JP | Nhật Bản | 2 | 1 | 21 | [jp-security-action](https://www.ipa.go.jp/security/security-action/sa/index.html), [jp-ipa-sme-2026](https://www.ipa.go.jp/security/guide/sme/ug65p90000019cbk-att/sme_guideline_v4.0_app_3.pdf) |
| KR | South Korea | 1 | 0 | 0 | [kr-isms-p-2023](https://isms.kisa.or.kr/ntcn/rcsrm/selectGnrlRcsrmList.do) |
| LK | Sri Lanka | 1 | 1 | 20 | [lk-cbsl-technology-risk](https://www.cbsl.gov.lk/sites/default/files/cbslweb_documents/laws/cdg/Banking_Act_Directions_No_16_of_2021.pdf) |
| MY | Malaysia | 1 | 1 | 20 | [my-bnm-rmit-2026](https://www.bnm.gov.my/documents/20124/938039/pd-rmit-sep26.pdf) |
| NZ | New Zealand | 1 | 1 | 16 | [nz-nzism-3-9](https://nzism.gcsb.govt.nz/ism-document) |
| PH | Philippines | 1 | 1 | 18 | [ph-npc-2023-06](https://privacy.gov.ph/wp-content/uploads/2024/03/NPC-Circular-Repeal-16-01-Signed.pdf) |
| PK | Pakistan | 1 | 0 | 0 | [pk-sbp-technology-risk](https://archive.sbp.org.pk/bprd/2017/C5.htm) |
| SG | Singapore | 2 | 1 | 22 | [sg-cyber-trust](https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/cyber-trust/certification-for-the-cyber-trust-mark/), [sg-cyber-essentials-2025](https://isomer-user-content.by.gov.sg/36/47c6066b-71a7-449f-82e0-e8cf10ee126f/cyber-essentials-v202504.pdf) |
| TH | Thailand | 1 | 1 | 20 | [th-bot-it-risk-2023](https://www.bot.or.th/content/dam/bot/fipcs/documents/FOG/2566/ThaiPDF/25660202.pdf) |
| TW | Taiwan | 1 | 1 | 16 | [tw-cybersecurity-act-2025](https://law.moda.gov.tw/EngLawContent.aspx?id=93&lan=E) |
| VN | Việt Nam | 1 | 1 | 89 | [vn-system-levels](https://congbao.chinhphu.vn/van-ban/luat-so-116-2025-qh15-468678/61574.htm) |

### Trung Đông

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| AE | United Arab Emirates | 1 | 1 | 13 | [ae-ia-2020](https://tdra.gov.ae/-/media/About/regulations-and-ruling/EN/UAE-Information-Assurance-Regulation-v1-1-pdf.ashx) |
| BH | Bahrain | 1 | 1 | 21 | [bh-cbb-om-2023](https://cbben.thomsonreuters.com/entiresection/115277) |
| IL | Israel | 1 | 0 | 0 | [il-data-security-2017](https://www.gov.il/BlobFolder/legalinfo/data_security_regulation/en/PROTECTION%20OF%20PRIVACY%20REGULATIONS.pdf) |
| OM | Oman | 1 | 0 | 0 | [om-pdpl-regulations-2026](https://www.mtcit.gov.om/sectors?sector=policies_and_governance) |
| QA | Qatar | 1 | 1 | 15 | [qa-nia-2014](https://qcert.ncsa.gov.qa/sites/default/files/public/documents/nia_policy__manual_english_v2.0_0.pdf) |
| SA | Saudi Arabia | 1 | 1 | 20 | [sa-ecc-2024](https://cdn.nca.gov.sa/api/files/public/upload/86e09090-44e4-481f-bc28-355673607654_ECC--2024-EN.pdf) |

### Châu Âu

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| AT | Austria | 1 | 0 | 0 | [at-security-framework-bund](https://www.bundeskanzleramt.gv.at/themen/cybersicherheit/security-framework-bund.html) |
| BE | Belgium | 1 | 0 | 0 | [be-cyfun](https://ccb.belgium.be/nl/news/cyfunr-2025-nu-beschikbaar) |
| CH | Switzerland | 1 | 0 | 0 | [ch-ict-minimum](https://www.bacs.admin.ch/de/ikt-minimalstandards) |
| CZ | Czechia | 1 | 0 | 0 | [cz-minimum-standard](https://nukib.gov.cz/download/publikace/podpurne_materialy/minimalni-bezpecnostni-standard_v1.2.pdf) |
| DE | Đức | 3 | 0 | 0 | [de-protection-needs](https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Grundschutz/International/bsi-standard-2002_en_pdf.pdf?__blob=publicationFile&v=2), [de-grundschutz-approaches](https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Grundschutz/International/bsi-standard-2002_en_pdf.pdf?__blob=publicationFile&v=2), [de-compendium-reference](https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium/IT_Grundschutz_Kompendium_Edition2023.pdf?__blob=publicationFile&v=4) |
| DK | Denmark | 1 | 1 | 18 | [dk-effective-defence](https://samsik.dk/wp-content/uploads/2025/09/vejledning-cyberforsvar-der-virker-2023.pdf) |
| EE | Estonia | 1 | 0 | 0 | [ee-eits](https://ria.ee/kuberturvalisus/riigi-infoturbe-meetmete-haldus/eesti-infoturbestandard-e-its) |
| ES | Spain | 1 | 1 | 23 | [es-ens](https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191) |
| FI | Finland | 1 | 1 | 20 | [fi-cyber-strengthening](https://kyberturvallisuuskeskus.fi/en/instructions-and-guides/instructions-and-guides-organisations-and-companies/strengthening-cyber-security-finnish-organisations-instructions-management-and-experts) |
| FR | France | 1 | 1 | 27 | [fr-anssi-hygiene](https://messervices.cyber.gouv.fr/documents-guides/guide_hygiene_informatique_anssi.pdf) |
| GB | Vương quốc Anh | 1 | 1 | 39 | [gb-cyber-essentials](https://www.ncsc.gov.uk/cyberessentials/resources) |
| GR | Greece | 1 | 1 | 20 | [gr-national-requirements](https://cyber.gov.gr/wp-content/uploads/2025/05/20250202186.pdf) |
| IE | Ireland | 1 | 1 | 23 | [ie-public-baseline](https://www.ncsc.gov.ie/pdfs/Cyber_Security_Baseline_Standards_Rev_1_2022_Final.pdf) |
| IT | Italy | 1 | 1 | 19 | [it-nis2-decree](https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=24G00155&atto.dataPubblicazioneGazzetta=2024-10-01&elenco30giorni=false) |
| NL | Netherlands | 1 | 1 | 22 | [nl-ncsc-webapps](https://www.ncsc.nl/api/media/sites/default/files/Richtlijn%20ICT%20beveiligingsrichtlijnen%20webapplicaties%2007-24_0.pdf) |
| NO | Norway | 1 | 0 | 0 | [no-nsm-principles](https://nsm.no/getfile.php/1313975-1717589722/NSM/Filer/Dokumenter/Veiledere/NSMs%20Grunnprinsipper%20for%20IKT-sikkerhet%20v2.1.pdf) |
| PL | Poland | 1 | 1 | 20 | [pl-kri](https://eli.gov.pl/api/acts/DU/2024/773/text.html) |
| PT | Portugal | 1 | 0 | 0 | [pt-qnrcs](https://www.cncs.gov.pt/docs/cncs-qnrcs-2019.pdf) |
| RO | Romania | 1 | 1 | 15 | [ro-nis2-ordinance](https://legislatie.just.ro/Public/DetaliiDocument/293121) |
| SE | Sweden | 1 | 1 | 22 | [se-agency-isms](https://www.mcf.se/sv/regler/gallande-regler/msbfs-20206/) |
| TR | Türkiye | 1 | 0 | 0 | [tr-information-guide](https://ms.hmb.gov.tr/uploads/2021/12/BG_Denetim_Rehberi-1.pdf) |

### Châu Mỹ

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| AR | Argentina | 1 | 0 | 0 | [ar-aaip-security](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-47-2018-312662) |
| BR | Brazil | 1 | 1 | 16 | [br-cmn-cyber](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4893&tipo=Resolu%C3%A7%C3%A3o+CMN) |
| CA | Canada | 1 | 1 | 14 | [ca-osfi-b13](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/technology-cyber-risk-management) |
| CL | Chile | 1 | 1 | 14 | [cl-cyber-law](https://www.bcn.cl/leychile/navegar?idNorma=1202434) |
| CO | Colombia | 1 | 0 | 0 | [co-personal-data-security](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) |
| CR | Costa Rica | 1 | 0 | 0 | [cr-personal-data-security](https://www.prodhab.go.cr/acercade/normativa/) |
| EC | Ecuador | 1 | 1 | 12 | [ec-lopdp-security](https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf) |
| MX | Mexico | 1 | 1 | 12 | [mx-public-data-security](https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf) |
| PA | Panama | 1 | 0 | 0 | [pa-personal-data-security](https://www.antai.gob.pa/wp-content/uploads/2021/05/Reglamentacio%CC%81n-de-Ley-81-de-Proteccio%CC%81n-de-Datos-Personales.pdf) |
| PE | Peru | 1 | 1 | 18 | [pe-data-security-reg](https://cdn.www.gob.pe/uploads/document/file/7568330/6426760-decreto-supremo-n-016-2024-jus-reglamento-de-la-ley-n-29733-ley-de-proteccion-de-datos-personales-publicado-nov-2024.pdf) |
| US | Hoa Kỳ | 3 | 1 | 18 | [us-fips-199](https://csrc.nist.gov/pubs/fips/199/final), [us-nist-csf](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20), [us-ftc-safeguards](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314/section-314.4) |
| UY | Uruguay | 1 | 1 | 18 | [uy-agesic-mcu](https://www.gub.uy/agencia-gobierno-electronico-sociedad-informacion-conocimiento/comunicacion/publicaciones/marco-ciberseguridad-50/marco-ciberseguridad-50) |

### Châu Phi

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| EG | Egypt | 1 | 0 | 0 | [eg-pdpl-security](https://www.pdpc.gov.eg/) |
| GH | Ghana | 1 | 1 | 17 | [gh-csa-cii](https://www.csa.gov.gh/resources/Directive_CII.pdf) |
| KE | Kenya | 1 | 1 | 14 | [ke-cbk-banking-cyber](https://www.centralbank.go.ke/uploads/banking_circulars/634077191_GUIDANCE%20NOTE%20ON%20CYBERSECURITY%20FOR%20THE%20BANKING%20SECTOR.pdf) |
| MA | Morocco | 1 | 1 | 12 | [ma-law0908-security](https://www.cndp.ma/wp-content/uploads/2023/11/Loi-09-08-Fr.pdf) |
| MU | Mauritius | 1 | 1 | 12 | [mu-dpa-security](https://dataprotection.govmu.org/Documents/DPA_2017.pdf) |
| NG | Nigeria | 1 | 0 | 0 | [ng-cbn-banking-cyber](https://www.cbn.gov.ng/Out/2024/BSD/CBN%20Risk-Based%20Cybersecurity%20Framework%20for%20DMBs%20and%20PSBs_2024.pdf) |
| RW | Rwanda | 1 | 1 | 12 | [rw-data-security](https://dpo.gov.rw/fileadmin/DPO/Law_relating_to_the_protection_of_personal_data_and_privacy.pdf) |
| TN | Tunisia | 1 | 0 | 0 | [tn-law2004-security](https://www.inpdp.tn/ressources/loi_2004.pdf) |
| ZA | South Africa | 1 | 1 | 12 | [za-popia-security](https://www.gov.za/sites/default/files/gcis_document/201409/3706726-11act4of2013popi.pdf) |

### Nhóm khu vực và quốc tế

| Mã | Quốc gia/vùng hoặc nhóm | Khung | Pack | Mục | Nguồn chính thức |
| --- | --- | ---: | ---: | ---: | --- |
| EU | European Union | 1 | 1 | 19 | [eu-nis2](https://eur-lex.europa.eu/eli/dir/2022/2555/oj?locale=en) |
| ZZ | International frameworks (not a country) | 2 | 1 | 37 | [int-owasp-asvs](https://raw.githubusercontent.com/OWASP/ASVS/5cf9b032440be53ce345ab3c130fda46ba1ce7a2/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json), [int-iso-27001](https://www.iso.org/standard/27001) |

## Ledger chi tiết và hạn chế còn lại

- [Châu Á–Thái Bình Dương / Trung Đông](../expansion/apac-middle-east.research.md)
- [Châu Âu / EU](../expansion/europe.research.md)
- [Châu Mỹ / Châu Phi](../expansion/americas-africa.research.md)
- [Nam Á bổ sung](../expansion/south-asia.research.md)
- [Chuẩn quốc tế và directory](../expansion/international.research.md)
- [Việt Nam](VN.md), [Australia / Anh](AU-GB.md), [ASVS benchmark](WEB-ASSURANCE.md), [attribution](THIRD-PARTY-NOTICES.md)

Các nước còn thiếu nguồn kỹ thuật vẫn có `NO_CURATED_CLAUSE_PACK`; các entry UN chưa research có `NATIONAL_FRAMEWORK_NOT_RESEARCHED`. Không biến directory 248 entry thành 248 checklist đã hoàn thành. ISO/TCVN cần toàn văn có giấy phép; văn bản ngành, transposition, designation và cập nhật sau ngày review vẫn cần bổ sung. Các khác biệt về phạm vi/ngưỡng không được giải quyết bằng một điểm số chung.

## Tra cứu và mở rộng

```powershell
node tools/country-security-harness/world-coverage.mjs summary
node tools/country-security-harness/world-coverage.mjs list
node tools/country-security-harness/world-coverage.mjs show VN
node tools/country-security-harness/world-coverage.mjs show EU
node tools/country-security-harness/world-coverage.mjs show AFG
node tools/country-security-harness/world-coverage.mjs directory
```

`show` dùng mã 2 ký tự trong catalog hoặc mã alpha-3 của directory (vd `AFG` đang pending). Đối với `framework_reference_only`, `clauses.mjs` từ chối bằng `PACK_UNSUPPORTED`. Framework mới cần batch đúng schema, nguồn/version/scope, crosswalk định danh cho quốc gia mới và pack đã đọc nguồn. Loader tự khám phá file đúng tên `FRAMEWORK_ID.requirements.json`, từ chối duplicate/unknown/unsafe entries. Việc nhập/mở rộng là thủ công có review; không có auto-sync tài liệu nguồn.
