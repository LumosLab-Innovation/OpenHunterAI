# APAC and Middle East primary-source research

Reviewed on **2026-10-08**. This batch contains **18 jurisdictions, 18 framework profiles, 13 partial requirement packs and 234 curated clauses**. Five profiles are catalog-only because a readable, appropriately current clause source was not established.

## Assessment boundary

Each profile selects `baseline`, an assessment target. No profile in this batch assigns a national grade, ranks countries, certifies compliance or authorises a network scan. Country/jurisdiction codes support catalog selection, including HK and TW; they do not express a geopolitical determination.

Offline checks compare operator-declared facts and opaque evidence references. They do not inspect document content or independently verify configuration or implementation. Framework applicability must be confirmed separately. Missing context remains unknown; a declared exclusion remains subject to review. `requires_review` records unresolved edition, consolidation, enforcement or retrieval gaps. `reviewed_reference` describes the inspected reference, not a complete audit of every law effective on the review date.

Nuanced legal decisions, alternative controls, classification, calendar deadlines and exception approval use manual review topics. Recommendations retain recommendation strength. Native article, section, control and question identifiers are retained in every mapped clause.

## Coverage

| Jurisdiction | Framework ID | Clauses | Reference status | Native distinction |
|---|---|---:|---|---|
| Singapore (SG) | `sg-cyber-essentials-2025` | 22 | `reviewed_reference` | Voluntary mark; selected classical baseline |
| Saudi Arabia (SA) | `sa-ecc-2024` | 20 | `reviewed_reference` | Essential controls; baseline |
| Hong Kong SAR (HK) | `hk-s17-2025` | 16 | `reviewed_reference` | Government policy; classified information context |
| Malaysia (MY) | `my-bnm-rmit-2026` | 20 | `reviewed_reference` | Financial-institution S/G duties; baseline |
| United Arab Emirates (AE) | `ae-ia-2020` | 13 | `requires_review` | Control priorities P1–P4, not maturity grades |
| Qatar (QA) | `qa-nia-2014` | 15 | `requires_review` | CIA classes and aggregate levels, not mapped |
| China (CN) | `cn-data-security-law-2021` | 16 | `reviewed_reference` | DSL data duties; MLPS is separate |
| Taiwan (TW) | `tw-cybersecurity-act-2025` | 16 | `requires_review` | Responsibility levels A–E, not assigned |
| Philippines (PH) | `ph-npc-2023-06` | 18 | `reviewed_reference` | Personal-data measures; baseline |
| Japan (JP) | `jp-ipa-sme-2026` | 21 | `reviewed_reference` | Self-diagnosis recommendations; no score |
| Indonesia (ID) | `id-ojk-cyber-2022` | 0 | `requires_review` | Bank cyber-risk ratings, not mapped |
| Thailand (TH) | `th-bot-it-risk-2023` | 20 | `requires_review` | Financial supervision; baseline |
| New Zealand (NZ) | `nz-nzism-3-9` | 16 | `reviewed_reference` | Protective classifications; selected All Classifications |
| Bahrain (BH) | `bh-cbb-om-2023` | 21 | `reviewed_reference` | Conventional-bank duties; baseline |
| South Korea (KR) | `kr-isms-p-2023` | 0 | `requires_review` | ISMS/ISMS-P certification; no grade |
| India (IN) | `in-cert-directions-2022` | 0 | `requires_review` | Directions; no protection grades |
| Oman (OM) | `om-pdpl-regulations-2026` | 0 | `requires_review` | Personal-data law; no grades |
| Israel (IL) | `il-data-security-2017` | 0 | `requires_review` | Individual/basic/medium/high database classes, not assigned |

## Sources, editions and scope

### Singapore — `sg-cyber-essentials-2025`

**Reference:** Second edition, April 2025 (scheme documents listed updated April 2026). [CSA Cyber Essentials mark, second edition](https://isomer-user-content.by.gov.sg/36/47c6066b-71a7-449f-82e0-e8cf10ee126f/cyber-essentials-v202504.pdf). Source locator: Sections 3.11 and 4; Annex A, classical cybersecurity column.

**Profile scope:** Organisations seeking the voluntary CSA Cyber Essentials mark. This pack covers selected classical cybersecurity clauses; cloud, OT, AI and sector sub-schemes require separate scoping.

The [CSA scheme publication page](https://www.csa.gov.sg/our-programmes/support-for-enterprises/sg-cyber-safe-programme/cybersecurity-certification-for-organisations/cyber-essentials/certification-for-the-cyber-essentials-mark/) lists documents updated in April 2026; the inspected PDF identifies itself as the second edition, April 2025. Page freshness is distinct from the edition printed in the document.

Selected clauses come from the classical cybersecurity column of Annex A. The certification scope must be selected by the operator. Cloud, OT and AI columns are additional work. A.1.4(e) remains a recommendation; A.7.4(a) does not produce an invented fixed patch deadline. A.5.4(o) includes qualifying important-system, sensitive/business-critical and substantial-personal-data administrative access.

### Saudi Arabia — `sa-ecc-2024`

**Reference:** ECC 2:2024. [NCA Essential Cybersecurity Controls ECC 2:2024, English](https://cdn.nca.gov.sa/api/files/public/upload/86e09090-44e4-481f-bc28-355673607654_ECC--2024-EN.pdf). Source locator: Scope of Work and Applicability; numbered ECC controls.

**Profile scope:** Saudi government agencies and affiliated entities, including affiliates inside and outside Saudi Arabia; private entities owning, operating or hosting Critical National Infrastructures. Other entities are encouraged adopters.

The [NCA publication page](https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/) publishes ECC 2:2024. The inspected English PDF contains the numbered controls selected in this pack.

Scope includes government agencies and their affiliates, including affiliates outside Saudi Arabia, and private entities owning, operating or hosting critical national infrastructure. Other entities are encouraged adopters. Separate CCC, DCC, CSCC and sector obligations are not included. Control identifiers are preserved from the 2024 edition.

### Hong Kong SAR — `hk-s17-2025`

**Reference:** Version 8.2, April 2025. [DPO Baseline IT Security Policy [S17] v8.2](https://www.govcert.gov.hk/doc/S17_EN.pdf). Source locator: Sections 9–16, numbered policy clauses.

**Profile scope:** Hong Kong Government bureaux and departments. This government baseline does not impose identical duties on every private website in Hong Kong.

The [DPO government security publication page](https://www.digitalpolicy.gov.hk/en/our_work/digital_infrastructure/information_cyber_security/government/) and the inspected S17 PDF identify version 8.2, April 2025.

This baseline applies to Government bureaux and departments. Sections 10.2.2 and 10.3.3 require classified-information context. Section 11.2.5 leaves the inactivity period to the bureau or department; no numeric period is invented. Logs follow the applicable business and policy retention requirements rather than a universal number.

### Malaysia — `my-bnm-rmit-2026`

**Reference:** Issued 25 September 2026. [Bank Negara Malaysia Risk Management in Technology, 25 September 2026](https://www.bnm.gov.my/documents/20124/938039/pd-rmit-sep26.pdf). Source locator: Paragraphs 2–5, 8–11; S and G clause markings.

**Profile scope:** Financial institutions specified in RMiT paragraph 2.1. Entity category, exemptions, transition provisions and applicable NCII status require owner review; not a baseline for all Malaysian systems.

The [BNM policy publication page](https://www.bnm.gov.my/-/pd-rmit-nov25) carries the updated policy dated 25 September 2026. The pack uses the September 2026 PDF, rather than assuming that the URL slug identifies the latest edition.

Paragraph 2.1 governs institution scope. Licensing categories, exclusions, transition provisions and NCII status need review. Selected clauses are marked S; G guidance is not upgraded to a mandatory rule. The future 30 September 2027 deadline in paragraph 10.31(a) is not treated as already due. Appendix 12 and the NCII Code of Practice remain outside this pack.

### United Arab Emirates — `ae-ia-2020`

**Reference:** Version 1.1, March 2020. [UAE Information Assurance Regulation v1.1](https://tdra.gov.ae/-/media/About/regulations-and-ruling/EN/UAE-Information-Assurance-Regulation-v1-1-pdf.ashx). Source locator: Sections 1.1 and 2.1; control tables, Always applicable controls.

**Profile scope:** UAE government entities and other entities identified as critical by the competent regulator under this source. Other entities may adopt voluntarily. Current designation and successor regulator requirements must be confirmed.

The inspected official TDRA PDF is UAE Information Assurance Regulation version 1.1, March 2020. Its control tables distinguish Always applicable controls from controls selected through risk assessment. The pack selects the former.

Government entities and entities identified as critical under the source are the mandatory scope; other adopters can be voluntary. Current regulator designations, sector rules and successor national or emirate policies have not been established by this research. Currency therefore remains requires_review. Implementation guidance labelled informational is not converted into a mandatory requirement.

### Qatar — `qa-nia-2014`

**Reference:** NIA Policy v2.0, February 2014. [Qatar National Information Assurance Policy v2.0](https://qcert.ncsa.gov.qa/sites/default/files/public/documents/nia_policy__manual_english_v2.0_0.pdf). Source locator: NIA Manual section A; section B policy families and starred baseline controls.

**Profile scope:** Agencies as defined by this NIA Manual include government, semi-government and private entities. Current NCSA applicability, NISCF certification directives and designation must be reviewed before applying the historical source.

The inspected NIA Manual is version 2.0, February 2014. A [newer NCSA NISCF audit-scope directive](https://ncsa.gov.qa/shared/document_library/94787172324409/33000/8811/1.0~0dee60d7-b28d-49e9-8c81-e870e9107dcf?filename=NCSA-NISCF-NIA-TD-AOS-001+%28NIA+Technical+Directive+on+Audit+Objectives+and+Scope+-+C0+-+Public%29_0+%283%29.pdf&mimetype=application%2Fpdf) took effect on 1 January 2025. The older manual is an explicit reference target, not a claim of complete current certification requirements.

Selected clauses are starred minimum controls. The source definition of agency covers government, semi-government and private organisations; actual current designation still needs review. RM1 requires a review of the medium/high aggregate-security asset condition. CIA classes and aggregate levels are not converted into an international country rating.

### China — `cn-data-security-law-2021`

**Reference:** Adopted 10 June 2021; effective 1 September 2021. [PRC Data Security Law, official CAC publication](https://www.cac.gov.cn/2021-06/11/c_1624994566919140.htm). Source locator: Articles 2, 27–40 and 55.

**Profile scope:** Data processing within China under Article 2; extraterritorial harms, important data, government data, regulated services and state secrets require separate legal scoping.

The official Chinese CAC publication contains the Data Security Law adopted on 10 June 2021. Article 55 states an effective date of 1 September 2021. The [NPC English reference text](https://en.npc.gov.cn.cdurl.cn/2021-06/10/c_689311_2.htm) helps reading; Chinese text governs.

The pack selects actual duties in Articles 27–40. Important data, network processing, intermediaries, foreign authority requests and government outsourcing use separate applicability facts. Article 32 is not paraphrased as an unconditional consent requirement. MLPS technical standards, PIPL, data-export measures, important-data catalogues and later network-data regulations are additional work.

### Taiwan — `tw-cybersecurity-act-2025`

**Reference:** Revised 24 September 2025, 35 articles. [MODA Cyber Security Management Act, revised 2025 official English text](https://law.moda.gov.tw/EngLawContent.aspx?id=93&lan=E). Source locator: Articles 3, 7–24 and 27–35.

**Profile scope:** Government agencies and specific non-government agencies defined by Article 3, including designated critical infrastructure providers. Responsibility levels and sector implementing rules require competent authority records.

The MODA official English text identifies the Cyber Security Management Act revised on 24 September 2025, expanded from 23 to 35 articles. The inspected Act delegates its enforcement date to an Executive Yuan order; that order and current subordinate instruments were not independently verified here.

Government agencies and specific non-government agencies have distinct duties. Article 10 contractor controls preserve the comprehensive-measures OR third-party-certification alternative. Native A–E responsibility levels require implementing rules and competent-authority records; this act-only pack does not assign them. Currency remains requires_review.

### Philippines — `ph-npc-2023-06`

**Reference:** 1 December 2023; effective 30 March 2024. [NPC Circular No. 2023-06, signed official circular](https://privacy.gov.ph/wp-content/uploads/2024/03/NPC-Circular-Repeal-16-01-Signed.pdf). Source locator: Sections 1, 4–18 and 23–27.

**Profile scope:** Natural and juridical persons processing personal data within and outside the Philippines subject to the DPA, IRR and NPC issuances; personal information controllers and processors.

The signed circular is NPC Circular 2023-06, dated 1 December 2023, effective 30 March 2024, replacing Circular 16-01. The [NPC announcement](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/) and [official FAQ](https://privacy.gov.ph/wp-content/uploads/2024/12/v12-19-2024_FAQ-NPC-Circular-2023-06_NNJ_JDN.pdf) distinguish the new circular from the older government-only issuance.

Scope covers controllers and processors subject to the DPA, IRR and NPC issuances. Sections 4A/4B registration conditions need manual review. Section 7 says to consider privacy by design and enable privacy by default. Section 16 qualifies sensitive OR privileged OR high-volume online access; MFA and encrypted links are examples rather than an invented universal MFA mandate or numeric high-volume threshold.

### Japan — `jp-ipa-sme-2026`

**Reference:** Version 4.0, March 2026; published annex updated 2026. [IPA SME guideline v4.0 Appendix 3, self-diagnosis](https://www.ipa.go.jp/security/guide/sme/ug65p90000019cbk-att/sme_guideline_v4.0_app_3.pdf). Source locator: Appendix 3 diagnosis items 1–25, PDF p3.

**Profile scope:** Voluntary guidance and self-diagnosis for Japanese SMEs, small businesses and sole proprietors. This is not ISMAP or a mandatory security level assigned to every Japanese system.

The [IPA publication page](https://www.ipa.go.jp/security/guide/sme/about.html) lists SME guideline version 4.0, published 27 March 2026, with subsequent wording and publication updates. The pack uses the Japanese Appendix 3 self-diagnosis, PDF page 3. The available English version 3.1 is not substituted for version 4.0.

These are voluntary recommendations for SMEs, small businesses and sole proprietors. The selected 21 items retain recommendation strength. Wireless, disposal, websites, BYOD, information-sharing partners and external services have explicit context. The self-diagnosis score, SECURITY ACTION and SCS stars are not calculated; ISMAP is a different scheme.

### Indonesia — `id-ojk-cyber-2022`

**Reference:** SEOJK 29/SEOJK.03/2022, effective 27 December 2022. [OJK SEOJK 29/SEOJK.03/2022, official full circular](https://ojk.go.id/id/regulasi/Documents/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum/SEOJK%2029%20SEOJK.03%202022.pdf). Source locator: Chapters II–IX and annexes.

**Profile scope:** Conventional and sharia commercial banks within POJK 11/POJK.03/2022 scope; not a uniform duty for all Indonesian websites.

The [OJK final publication page](https://ojk.go.id/id/regulasi/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum.aspx) identifies final SEOJK 29/SEOJK.03/2022 on commercial-bank cyber resilience and security. The final 111-page PDF was located but repeated retrieval failed. The [official summary](https://www.ojk.go.id/id/regulasi/Documents/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum/RINGKASAN%20SEOJK%2029%20-%2003%20-%202022-1.pdf) and draft RSEOJK snippets were distinguished from final full text.

Scope is conventional and sharia commercial banks, not all Indonesian websites. Native low-to-high cyber-risk ratings are not protection grades. Later banking/technology regulation consolidation needs review. Draft clauses and a high-level summary are insufficient to manufacture an executable final-law pack. Catalog only.

### Thailand — `th-bot-it-risk-2023`

**Reference:** Notification SorNorSor. 5/2566 (2023). [BOT IT risk supervision notification 5/2566, official Thai text](https://www.bot.or.th/content/dam/bot/fipcs/documents/FOG/2566/ThaiPDF/25660202.pdf). Source locator: Sections 4, 6, 7 and attachments.

**Profile scope:** Financial institutions and specialised financial institutions within notification section 4. Bank of Thailand implementing risk categories and sector supervision require review.

The inspected official Thai PDF is BOT notification SorNorSor. 5/2566 (2023), including attachments. Section 3 identifies the superseded 2019 notification; section 4 supplies the financial-institution and specialised-financial-institution scope.

Selected clauses distinguish required controls from guidance. MFA alternatives and authorised exceptions, vulnerability assessment timing, independent Internet-facing penetration testing, hardening exceptions and risk-based patching use manual checks where a simple boolean would erase conditions. Native Thai text controls; later circulars and current consolidation remain requires_review. A documentary penetration-test requirement does not execute a scan.

### New Zealand — `nz-nzism-3-9`

**Reference:** Version 3.9, April 2025; live document states updated November 2025. [GCSB New Zealand Information Security Manual v3.9](https://nzism.gcsb.govt.nz/ism-document). Source locator: Controls identified by native section and CID; sections 1.1, 2.2, 3 and 5.

**Profile scope:** New Zealand government departments, agencies and organisations; Crown entities, local government and private organisations are encouraged users under section 1.1.2. Selected controls are marked All Classifications.

The [GCSB archive](https://nzism.gcsb.govt.nz/about-the-nzism/archive) and [change overview](https://nzism.gcsb.govt.nz/about-the-nzism/change-overview) identify NZISM 3.9, April 2025; the live document states a November 2025 update. The selected official control text was retrieved by section and CID, including official indexed snippets where the large live page could not be opened in full.

The selected controls are All Classifications. Government applicability differs from encouraged use by Crown entities, local government and private organisations in section 1.1.2. MUST and SHOULD retain distinct strengths. These governance/documentation clauses do not constitute the full technical NZISM. Annual reviews and accreditation decisions use manual checks.

### Bahrain — `bh-cbb-om-2023`

**Reference:** Volume 1, OM-5.5; clauses dated July 2021–October 2023. [Central Bank of Bahrain Rulebook Volume 1 OM-5.5](https://cbben.thomsonreuters.com/entiresection/115277). Source locator: OM-5.5.5–OM-5.5.58, dated rulebook clauses.

**Profile scope:** Conventional bank licensees subject to CBB Rulebook Volume 1 Operational Risk Management. Foreign branch exceptions must be reviewed. Islamic banks have a separate Volume 2 rulebook.

The selected source is the published Central Bank of Bahrain Rulebook on its rulebook publishing platform, Volume 1 Operational Risk Management, OM-5.5. Clauses carry their own amendment dates. A [historical July 2022 module PDF](https://cbben.thomsonreuters.com/sites/default/files/net_file_store/Vol_1_OM_July_2022.pdf) corroborates earlier text; it is not labelled a consolidated October 2026 PDF.

Scope is conventional bank licensees. Islamic banks use Volume 2; foreign-branch alternatives need review. The pack selects bank duties rather than relabelling the generic NIST functions in OM-5.5.3. OM-5.5.57 provides the two numeric reporting checks; OM-5.5.58 uses a different occurrence-based clock and stays manual.

### South Korea — `kr-isms-p-2023`

**Reference:** Criteria guide November 2023; application forms v2.4 April 2026. [KISA ISMS-P official reference library](https://isms.kisa.or.kr/ntcn/rcsrm/selectGnrlRcsrmList.do). Source locator: Criteria guide entry 19 (2023-11-23); application-form entry 25 (2026-04-21).

**Profile scope:** Organisations applying for ISMS-P certification; mandatory ISMS eligibility and privacy-processing scope depend on Korean law, thresholds and certification rules. No universal South Korean website grade is inferred.

The official KISA reference library lists the criteria guide in entry 19 dated 23 November 2023 and application forms version 2.4 in entry 25 dated 21 April 2026. Updated application forms do not prove a new criteria edition. An [official 2024 certification guide](https://isms-p.kisa.or.kr/board/file/bbs_0000000000000014/24/FILE_000000000001059/20240724145927085-1505591884.pdf) supports scheme context.

The current full criteria attachment could not be retrieved reliably. Earlier PIMS and simplified small-company criteria are not substituted for the normal ISMS-P scheme. Mandatory ISMS eligibility and privacy-processing scope require law and threshold review. Catalog only; no executable clauses.

### India — `in-cert-directions-2022`

**Reference:** Directions 28 April 2022; FAQ May 2022 and extension June 2022. [CERT-In official Directions70B index](https://www.cert-in.org.in/Directions70B.jsp). Source locator: Directions 28.04.2022; FAQs; extension 27.06.2022.

**Profile scope:** Service providers, intermediaries, data centres, body corporates and government organisations as specified by the Directions; special customer/KYC duties have narrower provider scope.

The [CERT-In official attachment](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf) is linked from the verified Directions70B index, which also lists the May 2022 FAQ and 27 June 2022 extension. Repeated full PDF downloads timed out during this research.

Scope includes the organisations named in the Directions; customer-identification duties have a narrower provider scope. No reporting clock or log-retention number is derived from third-party summaries. The index confirms the reference, not a complete readable clause source. Catalog only; no executable clauses.

### Oman — `om-pdpl-regulations-2026`

**Reference:** Royal Decree 6/2022; regulation 34/2024; amendment 68/2026. [MTCIT Policies and Governance legislative index](https://www.mtcit.gov.om/sectors?sector=policies_and_governance). Source locator: Royal Decree 68/2026 published 6 September 2026; executive regulations 34/2024.

**Profile scope:** Controllers/processors within the Omani law, subject to statutory exclusions; state administrative units also have separate policy circular 6/2024.

The current MTCIT index lists Royal Decree 68/2026 amending the Personal Data Protection Law, published 6 September 2026. The earlier [executive-regulations page](https://mtcit.gov.om/library-3/legislations-policies-8/regulations-72/executive-regulations-of-the-personal-data-protection-law-1035) provides regulation 34/2024 under law 6/2022.

The [official 2024 Arabic PDF](https://mtcit.gov.om/web/content/mtcit.content/1035/attachment?download=True) was retrieved, but text extraction is damaged. The 2026 amendment prevents treating the 2024 document as a proven current consolidation. State administrative units also have separate circular 6/2024. No translated duty or breach deadline is fabricated. Catalog only.

### Israel — `il-data-security-2017`

**Reference:** 5777-2017 official convenience English translation. [Israeli Privacy Protection Authority Data Security Regulations, English translation](https://www.gov.il/BlobFolder/legalinfo/data_security_regulation/en/PROTECTION%20OF%20PRIVACY%20REGULATIONS.pdf). Source locator: Regulations 1–21 and Schedules; translation disclaimer.

**Profile scope:** Database controllers/processors under Israeli law, with individual-managed/basic/medium/high classes and regulation-specific applicability. Native security classes are not national grades.

The official convenience English translation is the Protection of Privacy Regulations (Data Security), 5777-2017. Its official indexed disclaimer states that only Hebrew is legally binding. The full translation download returned access errors; a current readable Hebrew consolidation was not established.

Individual-managed, basic, medium and high database security classes have regulation-specific conditions. Later Privacy Protection Law amendments may affect applicability. This work does not assign a class or infer inherited clause mappings from summaries. Catalog only; no executable clauses.

## Conditional context facts

All predicates below compare the declared value to `true`. A missing fact is `applicability_unknown`. A declared `false` can produce `not_applicable_on_declared_context` with `EXCLUSION_REQUIRES_REVIEW`; it does not satisfy the clause or establish a lawful exclusion. Context statements require the relevant competent operator/authority review.

| Context fact ID | Meaning of a declared true value |
|---|---|
| `sg-cyber-essentials-2025.hardware_disposal_present` | Hardware is disposed of or decommissioned within the scheme scope. |
| `sg-cyber-essentials-2025.qualifying_admin_access_present` | Administrative access falls within A.5.4(o): important systems, sensitive/business-critical data or substantial personal data; verify the exact source scope. |
| `hk-s17-2025.classified_data_present` | The bureau/department stores information classified under its applicable classification policy. |
| `hk-s17-2025.classified_media_disposal_present` | Disposal concerns media containing classified information. |
| `my-bnm-rmit-2026.critical_source_changes_present` | The RMiT critical-system source-code/change condition in paragraph 10.10 applies. |
| `ae-ia-2020.nonconformities_present` | The IA management review or audit found nonconformities needing corrective action. |
| `qa-nia-2014.medium_high_assets_present` | The NIA aggregate-security asset scope meets the RM1 medium/high condition. |
| `cn-data-security-law-2021.network_processing_present` | Data processing uses information networks, triggering Article 27 MLPS-related review. |
| `cn-data-security-law-2021.important_data_present` | The organisation processes important data as determined under applicable Chinese catalogues and rules. |
| `cn-data-security-law-2021.data_risks_discovered` | A data-security defect, vulnerability or other risk has been discovered. |
| `cn-data-security-law-2021.data_incident_present` | A data-security incident has occurred, requiring Article 29 response/notification review. |
| `cn-data-security-law-2021.data_intermediary_present` | The organisation provides data-transaction intermediary services. |
| `cn-data-security-law-2021.licence_required` | Applicable Chinese law or regulation requires an administrative licence for this data-processing service. |
| `cn-data-security-law-2021.foreign_request_present` | Data in China is requested by a foreign judicial or law-enforcement authority. |
| `cn-data-security-law-2021.government_outsourcing_present` | A government department entrusts government-data storage or processing to another party. |
| `cn-data-security-law-2021.government_data_contractor` | The assessed organisation is a contractor receiving government data under Article 40. |
| `tw-cybersecurity-act-2025.audit_deficiencies_present` | An applicable authority audit identified deficiencies requiring correction. |
| `tw-cybersecurity-act-2025.outsourcing_present` | A covered Taiwanese agency outsources within Article 10. |
| `tw-cybersecurity-act-2025.government_agency` | The organisation is a government agency as defined by the Taiwanese Act. |
| `tw-cybersecurity-act-2025.specific_non_gov_agency` | The organisation belongs to a designated specific non-government agency category under Article 3. |
| `ph-npc-2023-06.storage_processor_present` | A processor is engaged for personal-data storage under NPC section 10. |
| `ph-npc-2023-06.processor_access_present` | A personal-information processor receives access to personal data under section 14. |
| `ph-npc-2023-06.qualifying_online_access_present` | Online access concerns sensitive OR privileged OR high-volume personal data; do not require all three or invent a volume threshold. |
| `ph-npc-2023-06.pic_owned_mobile_devices` | PIC-owned mobile devices access or process personal data under section 18. |
| `jp-ipa-sme-2026.wireless_network_present` | Wireless network access is in use. |
| `jp-ipa-sme-2026.data_disposal_present` | Information-bearing devices or media are being disposed of. |
| `jp-ipa-sme-2026.website_present` | The SME operates or publishes a website. |
| `jp-ipa-sme-2026.byod_present` | Personally owned devices are used for work. |
| `jp-ipa-sme-2026.information_sharing_partners` | Information is shared with external business partners. |
| `jp-ipa-sme-2026.external_services_present` | External services or suppliers handle the SME's relevant information. |
| `th-bot-it-risk-2023.public_customer_data_access` | User access over public networks reaches customer data within Attachment 2 point 3.2(2). |
| `th-bot-it-risk-2023.internet_facing_systems` | Systems exposed to the Internet fall within the independent testing condition. |
| `nz-nzism-3-9.offsite_it_contractors` | IT contractors provide services from a separate location under NZISM 2.2.5. |
| `nz-nzism-3-9.security_bypass_required` | A system security policy must be bypassed; formal approval and conditions need review. |
| `bh-cbb-om-2023.qualifying_incident_present` | The incident compromises customer information or disrupts critical services affecting bank operations under OM-5.5.57. |

## Numeric clocks and manual intervals

Only two requirements in this batch use numeric time bounds. Both apply to a qualifying incident under CBB OM-5.5.57:

| Fact ID | Maximum | Source and trigger |
|---|---:|---|
| `bh-cbb-om-2023.cbb-contact-elapsed-hours` | 1 hour | OM-5.5.57: occurrence/detection clock; contact CBB. |
| `bh-cbb-om-2023.initial-report-elapsed-hours` | 2 hours | OM-5.5.57: occurrence/detection clock; Section A initial report. |

The operator must review occurrence/detection timestamps, the applicable event trigger and actual report delivery evidence. A declared duration is not a measurement performed by the harness. OM-5.5.58 Section B uses ten calendar days **from occurrence**, followed by weekly updates until resolution, so its checks remain manual. Annual, three-year, change-triggered and as-feasible requirements are not converted into approximate day counts.

## Download provenance

Hashes below identify the bytes inspected during this research. They are provenance snapshots, not signatures of authenticity or evidence that a URL never changes. PDF page counts use the complete retrieved file. Clause locators refer to the source's native numbering; page numbers marked PDF are file-page numbers.

| Retrieved primary source | PDF pages | Bytes | SHA-256 |
|---|---:|---:|---|
| SG | 48 | 595935 | `5898d9596c02d63505ed7cc51f8f408a1929823d099f83c7abb0092106152dc0` |
| SA | 56 | 1231347 | `146505199e5374d99302fc3d7e1fdc73b6e2f3292fefd535d5dd891294a81db1` |
| HK | 45 | 763716 | `d3f241463df39bda79cd2c2dd6950a076f4f5f5476a92536b01431c180069dde` |
| MY | 113 | 1209893 | `d7b8e6753a78514e90fbfe0cef6bd40ff8bccbfc60e17c7575db4cec1fba6cd6` |
| AE | 247 | 1197412 | `636990f28c97d7f7a2d6816cf1130223472e82d9ccda523a622aa64e0d8f5f41` |
| QA | 62 | 1762483 | `4df5ae6922a89d127cc39f93eb578c3c9ecdc96390e832ff723034c1bcee7a86` |
| JP Appendix 3 | 8 | 2327133 | `48c297cb05d58b7b5f1c06090e3bbaf19c9dcffa9e9af9862ace8b703e349d8d` |
| TH | 107 | 2193906 | `2ac1c8e42887d105c9e5e6b69b0773443745ed946698ec781fd0aeea9b723ab8` |
| OM 2024 regulation, no pack | 14 | 198588 | `43fdb2a30ab82b2cb7d76be1f01c9430252d986c3e8436d61267852ba4d6c552` |

PH, CN, TW and BH selected text was read from official web/PDF tool results rather than retained local files. NZ selected controls were retrieved by their official identifiers, including primary indexed control text; no full local manual download was retained. No download hash is asserted for these sources. KR/IN/IL/ID full target attachments were not retrieved reliably. The retrieved OM PDF cannot support a current translated executable pack.

## Clause locator index

This index makes the curated selection reviewable. Full labels, checks, applicability predicates, evidence kinds and interpretation notes are in the corresponding requirement JSON. `mandatory` describes strength within the source's applicable scope, including the voluntarily selected SG certification scheme; it is not a claim that every organisation in that jurisdiction has a statutory duty.

### `sg-cyber-essentials-2025` — 22 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `training` | Annex A, A.1.4(a) | boolean | mandatory |
| `hygiene-guidelines` | Annex A, A.1.4(b) | boolean | mandatory |
| `asset-inventory` | Annex A, A.2.4(a) | boolean | mandatory |
| `asset-onboarding` | Annex A, A.2.4(h) | boolean | mandatory |
| `asset-approval-date` | Annex A, A.2.4(i) | boolean | mandatory |
| `sanitise-disposal` | Annex A, A.2.4(k) | boolean | mandatory |
| `data-inventory` | Annex A, A.3.4(a) | boolean | mandatory |
| `data-protection` | Annex A, A.3.4(c) | manual | mandatory |
| `malware-protection` | Annex A, A.4.4(a) | boolean | mandatory |
| `malware-scan` | Annex A, A.4.4(b) | boolean | mandatory |
| `firewall` | Annex A, A.4.4(e) | boolean | mandatory |
| `account-inventory` | Annex A, A.5.4(a)-(b) | boolean | mandatory |
| `access-approval` | Annex A, A.5.4(c) | boolean | mandatory |
| `least-privilege` | Annex A, A.5.4(d) | boolean | mandatory |
| `admin-separation` | Annex A, A.5.4(f) | boolean | mandatory |
| `admin-mfa` | Annex A, A.5.4(o) | manual | mandatory |
| `unused-services` | Annex A, A.6.4(c) | boolean | mandatory |
| `audit-logs` | Annex A, A.6.4(g) | boolean | mandatory |
| `security-updates` | Annex A, A.7.4(a) | manual | mandatory |
| `critical-backups` | Annex A, A.8.4(a) | boolean | mandatory |
| `incident-plan` | Annex A, A.9.4(a) | boolean | mandatory |
| `annual-training` | Annex A, A.1.4(e) | manual | recommendation |

### `sa-ecc-2024` — 20 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `strategy` | Control 1-1-1 | boolean | mandatory |
| `strategy-plan` | Control 1-1-2 | boolean | mandatory |
| `security-department` | Control 1-2-1 | boolean | mandatory |
| `approved-policies` | Control 1-3-1 | boolean | mandatory |
| `roles` | Control 1-4-1 | boolean | mandatory |
| `acceptable-use` | Control 2-1-3 | boolean | mandatory |
| `asset-classification` | Control 2-1-5 | boolean | mandatory |
| `authentication` | Control 2-2-3, subcontrol 2.2.3.1 | boolean | mandatory |
| `remote-mfa` | Control 2-2-3, subcontrol 2.2.3.2 | manual | mandatory |
| `least-privilege` | Control 2-2-3, subcontrol 2.2.3.3 | boolean | mandatory |
| `privileged-access` | Control 2-2-3, subcontrol 2.2.3.4 | boolean | mandatory |
| `access-review` | Control 2-2-3, subcontrol 2.2.3.5 | boolean | mandatory |
| `endpoint-protection` | Control 2-3-3, subcontrol 2.3.3.1 | boolean | mandatory |
| `external-media` | Control 2-3-3, subcontrol 2.3.3.2 | boolean | mandatory |
| `patches` | Control 2-3-3, subcontrol 2.3.3.3 | boolean | mandatory |
| `time-source` | Control 2-3-3, subcontrol 2.3.3.4 | boolean | mandatory |
| `critical-backup-scope` | Control 2-9-3, subcontrol 2.9.3.1 | boolean | mandatory |
| `restore-tests` | Control 2-9-3, subcontrol 2.9.3.3 | boolean | mandatory |
| `critical-event-logs` | Control 2-12-3, subcontrol 2.12.3.1 | boolean | mandatory |
| `privileged-event-logs` | Control 2-12-3, subcontrol 2.12.3.2 | boolean | mandatory |

### `hk-s17-2025` — 16 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `staff-awareness` | Clause 9.1.2 | boolean | mandatory |
| `asset-inventory` | Clause 10.1.1 | boolean | mandatory |
| `classified-encryption` | Clause 10.2.2 | boolean | mandatory |
| `media-sanitisation` | Clause 10.3.3 | boolean | mandatory |
| `least-privilege` | Clause 11.1.1 | boolean | mandatory |
| `access-process` | Clause 11.2.1 | boolean | mandatory |
| `access-review` | Clause 11.2.4 | boolean | mandatory |
| `access-revocation` | Clause 11.2.5 | manual | mandatory |
| `endpoint-antimalware` | Clause 14.2.1 | boolean | mandatory |
| `backup-policy` | Clause 14.3.2 | boolean | mandatory |
| `restoration-tests` | Clause 14.3.3 | boolean | mandatory |
| `logging-policy` | Clause 14.4.1 | boolean | mandatory |
| `change-control` | Clause 14.5.2 | boolean | mandatory |
| `network-protection` | Clause 15.1.2 | boolean | mandatory |
| `secure-development` | Clause 16.1.1 | boolean | mandatory |
| `development-environment` | Clause 16.2.1 | boolean | mandatory |

### `my-bnm-rmit-2026` — 20 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `risk-appetite` | S paragraph 8.1 | boolean | mandatory |
| `board-committee` | S paragraph 8.3 | boolean | mandatory |
| `audit-capability` | S paragraph 8.5 | boolean | mandatory |
| `cross-functional-committee` | S paragraph 8.7 | boolean | mandatory |
| `trmf-integration` | S paragraph 9.1 | boolean | mandatory |
| `independent-risk-function` | S paragraph 9.3 | boolean | mandatory |
| `ciso` | S paragraph 9.4 | boolean | mandatory |
| `secure-sdlc` | S paragraph 10.5 | boolean | mandatory |
| `environment-separation` | S paragraph 10.7 | manual | mandatory |
| `system-testing` | S paragraph 10.8 | boolean | mandatory |
| `critical-code-review` | S paragraph 10.10 | boolean | mandatory |
| `change-approval` | S paragraph 10.11 | boolean | mandatory |
| `crypto-policy` | S paragraph 10.20 | boolean | mandatory |
| `crypto-due-diligence` | S paragraph 10.21 | manual | mandatory |
| `data-centre-resilience` | S paragraph 10.24 | boolean | mandatory |
| `capacity-monitoring` | S paragraph 10.30 | boolean | mandatory |
| `cyber-framework` | S paragraph 11.2 | boolean | mandatory |
| `threat-intelligence` | S paragraph 11.10 | boolean | mandatory |
| `crisis-procedures` | S paragraph 11.12 | boolean | mandatory |
| `incident-plan` | S paragraph 11.13 | boolean | mandatory |

### `ae-ia-2020` — 13 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `entity-context` | Control M1.1.1, PDF p32 | boolean | mandatory |
| `leadership` | Control M1.1.2, PDF p33 | boolean | mandatory |
| `security-manager` | Control M1.1.3, PDF p34 | boolean | mandatory |
| `policy` | Control M1.2.1, PDF p36 | boolean | mandatory |
| `authorisation` | Control M1.3.1, PDF p38 | boolean | mandatory |
| `confidentiality` | Control M1.3.2, PDF p39 | boolean | mandatory |
| `risk-policy` | Control M2.1.1, PDF p49 | boolean | mandatory |
| `risk-identification` | Control M2.2.1, PDF p51 | boolean | mandatory |
| `risk-evaluation` | Control M2.2.3, PDF p54 | boolean | mandatory |
| `risk-treatment` | Control M2.3.1, PDF p55 | boolean | mandatory |
| `hr-policy` | Control M4.1.1 | boolean | mandatory |
| `internal-audits` | Control M6.2.2, PDF p90 | boolean | mandatory |
| `corrective-actions` | Control M6.3.1, PDF p91 | boolean | mandatory |

### `qa-nia-2014` — 15 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `security-manager` | NIA Manual section B, Governance Structure IG1 (starred), PDF p18 | boolean | mandatory |
| `security-budget` | NIA Manual section B, IG2 (starred), PDF p18 | boolean | mandatory |
| `reporting-line` | NIA Manual section B, IG3 (starred), PDF p18 | boolean | mandatory |
| `management-support` | NIA Manual section B, IG4 (starred), PDF p18 | boolean | mandatory |
| `risk-assessment` | NIA Manual section B, RM1 (starred), PDF p19 | manual | mandatory |
| `risk-treatment` | NIA Manual section B, RM2 (starred), PDF p19 | boolean | mandatory |
| `change-process` | NIA Manual section B, CM1 (starred), PDF p21 | boolean | mandatory |
| `hr-obligations` | NIA Manual section B, PS2 (starred), PDF p22 | boolean | mandatory |
| `awareness-programme` | NIA Manual section B, SA1 (starred), PDF p22 | boolean | mandatory |
| `incident-owner` | NIA Manual section B, IM1 (starred), PDF p23 | boolean | mandatory |
| `continuity-owner` | NIA Manual section B, BC1 (starred), PDF p24 | boolean | mandatory |
| `continuity-plan` | NIA Manual section B, BC2 (starred), PDF p24 | boolean | mandatory |
| `security-monitoring` | NIA Manual section B, SM1 (starred), PDF p25 | boolean | mandatory |
| `retention-policy` | NIA Manual section B, DR1 (starred), PDF p26 | boolean | mandatory |
| `retained-data` | NIA Manual section B, DR2 (starred), PDF p26 | boolean | mandatory |

### `cn-data-security-law-2021` — 16 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `lifecycle-policy` | Article 27 paragraph 1 | boolean | mandatory |
| `training` | Article 27 paragraph 1 | boolean | mandatory |
| `technical-measures` | Article 27 paragraph 1 | manual | mandatory |
| `network-mlps` | Article 27 paragraph 1 | manual | mandatory |
| `important-data-roles` | Article 27 paragraph 2 | boolean | mandatory |
| `risk-monitoring` | Article 29 | boolean | mandatory |
| `risk-remediation` | Article 29 | manual | mandatory |
| `incident-response` | Article 29 | manual | mandatory |
| `important-assessment` | Article 30 paragraph 1 | boolean | mandatory |
| `assessment-content` | Article 30 paragraph 2 | boolean | mandatory |
| `lawful-collection` | Article 32 paragraph 1 | manual | mandatory |
| `transaction-records` | Article 33 | boolean | mandatory |
| `licensed-service` | Article 34 | manual | mandatory |
| `foreign-request` | Article 36 | manual | mandatory |
| `government-outsourcing` | Article 40 first sentence | boolean | mandatory |
| `government-contractor` | Article 40 second sentence | manual | mandatory |

### `tw-cybersecurity-act-2025` — 16 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `level-record` | Article 7 paragraph 1 | manual | mandatory |
| `level-measures` | Article 7 paragraph 2 | manual | mandatory |
| `audit-correction` | Article 8 paragraph 2 | boolean | mandatory |
| `contractor-selection` | Article 10 paragraph 1 | boolean | mandatory |
| `contractor-environment` | Article 10 paragraph 2 | manual | mandatory |
| `written-contract` | Article 10 paragraph 3 | boolean | mandatory |
| `drill-cooperation` | Article 10 paragraph 4 | boolean | mandatory |
| `gov-restricted-products` | Article 11 paragraphs 1–3 | manual | mandatory |
| `gov-ciso` | Article 12 | boolean | mandatory |
| `gov-maintenance-plan` | Article 13 | boolean | mandatory |
| `gov-annual-report` | Article 14 | manual | mandatory |
| `gov-incident-mechanism` | Article 17 paragraph 1 | boolean | mandatory |
| `gov-personnel` | Article 18 paragraph 1 | boolean | mandatory |
| `non-gov-maintenance` | Article 20 paragraph 2; Article 21 paragraph 1 | boolean | mandatory |
| `non-gov-ciso` | Article 23 | boolean | mandatory |
| `non-gov-incident` | Article 24 paragraph 1 | boolean | mandatory |

### `ph-npc-2023-06` — 18 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `dpo` | Section 4(A) | manual | mandatory |
| `systems-registration` | Section 4(B) | manual | mandatory |
| `processing-inventory` | Section 4(C) | boolean | mandatory |
| `pia` | Section 4(D) | boolean | mandatory |
| `privacy-programme` | Section 4(E) | boolean | mandatory |
| `staff-training` | Section 4(F) | boolean | mandatory |
| `pia-controls` | Section 6 | boolean | mandatory |
| `privacy-default` | Section 7 | boolean | mandatory |
| `unlawful-functions` | Section 7 last paragraph | manual | mandatory |
| `storage-provider` | Section 10 | boolean | mandatory |
| `password-policy` | Section 11 paragraph 2 | boolean | mandatory |
| `authorised-software` | Section 12 | boolean | mandatory |
| `access-policy` | Section 13 paragraphs 1–2 | boolean | mandatory |
| `processor-contract` | Section 14 | boolean | mandatory |
| `acceptable-use` | Section 15 | boolean | mandatory |
| `online-authentication` | Section 16 | manual | mandatory |
| `known-devices` | Section 17 | boolean | mandatory |
| `mobile-loss` | Section 18 | boolean | mandatory |

### `jp-ipa-sme-2026` — 21 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `software-updates` | Appendix 3, diagnosis item 1, PDF p3 | boolean | recommendation |
| `antimalware` | Appendix 3, diagnosis item 2, PDF p3 | boolean | recommendation |
| `strong-passwords` | Appendix 3, diagnosis item 3, PDF p3 | boolean | recommendation |
| `restricted-sharing` | Appendix 3, diagnosis item 4, PDF p3 | boolean | recommendation |
| `backups` | Appendix 3, diagnosis item 5, PDF p3 | boolean | recommendation |
| `threat-awareness` | Appendix 3, diagnosis item 6, PDF p3 | boolean | recommendation |
| `phishing-awareness` | Appendix 3, diagnosis item 7, PDF p3 | boolean | recommendation |
| `recipient-check` | Appendix 3, diagnosis item 8, PDF p3 | boolean | recommendation |
| `secure-transfer` | Appendix 3, diagnosis item 9, PDF p3 | boolean | recommendation |
| `wireless-security` | Appendix 3, diagnosis item 10, PDF p3 | boolean | recommendation |
| `physical-storage` | Appendix 3, diagnosis item 12, PDF p3 | boolean | recommendation |
| `secure-disposal` | Appendix 3, diagnosis item 14, PDF p3 | boolean | recommendation |
| `screen-lock` | Appendix 3, diagnosis item 15, PDF p3 | boolean | recommendation |
| `network-access` | Appendix 3, diagnosis item 18, PDF p3 | boolean | recommendation |
| `website-publication` | Appendix 3, diagnosis item 19, PDF p3 | boolean | recommendation |
| `staff-education` | Appendix 3, diagnosis item 20, PDF p3 | boolean | recommendation |
| `byod-policy` | Appendix 3, diagnosis item 21, PDF p3 | boolean | recommendation |
| `confidentiality-contracts` | Appendix 3, diagnosis item 22, PDF p3 | boolean | recommendation |
| `supplier-selection` | Appendix 3, diagnosis item 23, PDF p3 | boolean | recommendation |
| `incident-preparation` | Appendix 3, diagnosis item 24, PDF p3 | boolean | recommendation |
| `written-rules` | Appendix 3, diagnosis item 25, PDF p3 | boolean | recommendation |

### `th-bot-it-risk-2023` — 20 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `governance` | Section 7.1; Attachment 1 | boolean | mandatory |
| `risk-management` | Section 7.3; Attachment 3 | boolean | mandatory |
| `compliance` | Section 7.4; Attachment 4 | boolean | mandatory |
| `audit` | Section 7.5; Attachment 5 | boolean | mandatory |
| `asset-inventory` | Attachment 2, point 1, PDF p16 | boolean | mandatory |
| `data-security` | Attachment 2, point 2, PDF p16 | boolean | mandatory |
| `privileged-control` | Attachment 2, point 3.1, PDF p16 | boolean | mandatory |
| `privileged-mfa` | Attachment 2, point 3.2(1), PDF p16–17 | manual | mandatory |
| `customer-remote-mfa` | Attachment 2, point 3.2(2), PDF p16–17 | manual | mandatory |
| `physical-security` | Attachment 2, point 4, PDF p17 | boolean | mandatory |
| `communications` | Attachment 2, point 5, PDF p17 | boolean | mandatory |
| `logging` | Attachment 2, point 6.4, PDF p18 | boolean | mandatory |
| `monitoring` | Attachment 2, point 6.5, PDF p18 | boolean | mandatory |
| `vulnerability-management` | Attachment 2, point 6.6, PDF p18 | manual | mandatory |
| `independent-testing` | Attachment 2, point 6.7, PDF p18 | manual | mandatory |
| `change-control` | Attachment 2, point 6.8, PDF p18 | boolean | mandatory |
| `hardening` | Attachment 2, point 6.9, PDF p18–19 | manual | mandatory |
| `patch-process` | Attachment 2, point 6.10, PDF p19 | manual | mandatory |
| `incident-root-cause` | Attachment 2, point 8, PDF p20 | boolean | mandatory |
| `disaster-recovery-plan` | Attachment 2, points 9.1–9.2, PDF p20 | boolean | mandatory |

### `nz-nzism-3-9` — 16 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `contractor-accreditation` | Control 2.2.5.C.01, CID216 (All Classifications; MUST) | manual | mandatory |
| `agency-support` | Control 3.1.9.C.01, CID288 (All Classifications; MUST) | boolean | mandatory |
| `ciso-clearance` | Control 3.2.8.C.01, CID307 (All Classifications; MUST) | manual | mandatory |
| `ciso-role` | Control 3.2.8.C.02, CID308 (All Classifications; SHOULD) | boolean | recommendation |
| `ciso-conflicts` | Control 3.2.8.C.05, CID311 (All Classifications; SHOULD) | boolean | recommendation |
| `ciso-reporting` | Control 3.2.9.C.01, CID314 (All Classifications; SHOULD) | boolean | recommendation |
| `strategic-programme` | Control 3.2.10.C.01, CID317 (All Classifications; SHOULD) | boolean | recommendation |
| `awareness-oversight` | Control 3.2.18.C.01, CID351 (All Classifications; SHOULD) | boolean | recommendation |
| `security-plans` | Control 3.3.8.C.01, CID391 (All Classifications; MUST) | boolean | mandatory |
| `user-policy` | Control 3.5.4.C.01, CID466 (All Classifications; MUST) | boolean | mandatory |
| `authenticator-care` | Control 3.5.4.C.02, CID467 (All Classifications; MUST) | boolean | mandatory |
| `bypass-authorisation` | Control 3.5.4.C.03, CID468 (All Classifications; MUST) | boolean | mandatory |
| `agency-policy` | Control 5.1.7.C.01, CID692 (All Classifications; MUST) | boolean | mandatory |
| `system-security-plan` | Control 5.1.10.C.01, CID702 (All Classifications; MUST) | boolean | mandatory |
| `standard-procedures` | Control 5.1.11.C.01, CID705 (All Classifications; MUST) | boolean | mandatory |
| `document-review` | Control 5.1.21.C.02, CID768 (All Classifications; SHOULD) | manual | recommendation |

### `bh-cbb-om-2023` — 21 clauses

| Requirement suffix | Native source locator | Check | Strength |
|---|---|---|---|
| `board-framework-review` | OM-5.5.5 | manual | mandatory |
| `independent-risk` | OM-5.5.6 | manual | mandatory |
| `cyber-strategy` | OM-5.5.13 | boolean | mandatory |
| `policy-review` | OM-5.5.15 | manual | mandatory |
| `epp-edr` | OM-5.5.18(a) | boolean | mandatory |
| `dlp` | OM-5.5.18(b) | boolean | mandatory |
| `segmentation-waf` | OM-5.5.18(c) | boolean | mandatory |
| `development-testing` | OM-5.5.18(d) | boolean | mandatory |
| `privileged-access` | OM-5.5.18(e) | boolean | mandatory |
| `email-gateway` | OM-5.5.18(f) | boolean | mandatory |
| `web-gateway` | OM-5.5.18(g) | boolean | mandatory |
| `application-allowlist` | OM-5.5.18(h) | boolean | mandatory |
| `mobile-management` | OM-5.5.18(i) | boolean | mandatory |
| `network-access-control` | OM-5.5.18(j) | boolean | mandatory |
| `account-management` | OM-5.5.18(k) | boolean | mandatory |
| `siem` | OM-5.5.31 | boolean | mandatory |
| `soc` | OM-5.5.35 | boolean | mandatory |
| `cbb-contact` | OM-5.5.57 | number | mandatory |
| `initial-report` | OM-5.5.57 | number | mandatory |
| `full-report` | OM-5.5.58 | manual | mandatory |
| `weekly-progress` | OM-5.5.58 | manual | mandatory |

## Remaining research work

- Obtain current readable KISA normal ISMS-P criterion attachments; separate mandatory eligibility from certification requirements and simplified schemes.
- Retrieve CERT-In directions, FAQ and extensions in full before adding reporting, clock or retention clauses.
- Read Oman's 2026 amendment with the binding Arabic law and regulations; obtain reliable extraction or a qualified translation.
- Obtain the binding current Israeli Hebrew regulations and check effects of subsequent statutory amendments before assigning native security classes.
- Retrieve the final OJK circular and current consolidation; exclude draft RSEOJK text from mappings.
- Confirm UAE successor regulator/sector requirements, Qatar NISCF current directives, Taiwan enforcement orders/subordinate rules, and Thailand current BOT consolidation.
- Expand MY sector/NCII appendices and staged deadlines; expand CN MLPS/PIPL/data-transfer catalogues, SG cloud/OT/AI, HK G3, NZ technical controls and Bahrain other banking volumes as separate scoped work.

## Verification record

The final batch and all 13 packs passed catalog/requirement schema validation against the integrated catalog. Independent checks of all 13 blank templates and declared matching-fact inputs preserve `not_determined`, `formalLevelDetermination: false` and `contentVerified: false`. Each applicable `requires_review` profile retains `FRAMEWORK_REVIEW_REQUIRED` even with matching declared facts. The local clause-engine suite passed **34/34** tests after these packs were added, including unresolved framework currency and empty evidence behavior. This verifies harness input semantics; it does not validate implementation at an assessed organisation.

Source review clarified SG qualifying administrative scope and PH privacy-by-design wording and online-access scope. PH online access is an OR across sensitive, privileged and high-volume categories. SG and PH predicate names preserve that wider source scope; narrow names such as sensitive-only are not used.

