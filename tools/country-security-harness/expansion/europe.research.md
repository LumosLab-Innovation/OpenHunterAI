# Europe source ledger and curated requirement packs

Reviewed against official sources on **2026-10-08**. This batch adds **20 countries** and the **EU as a supranational jurisdiction**, with **12 partial packs and 248 curated clauses**. The separate existing German protection-needs and implementation-approach records are preserved.

The files are offline assessment references. Fact declarations and evidence references are metadata. A satisfied predicate does not establish legal compliance, certification, a national security grade, independent replay or absence of vulnerabilities.

## Coverage inventory

| Jurisdiction | Framework ID | Curated clauses | Currency status | Pinned version |
| --- | --- | ---: | --- | --- |
| PL | pl-kri | 20 | reviewed_reference | Regulation of 21 May 2024; Dz.U.2024 poz.773 |
| FI | fi-cyber-strengthening | 20 | reviewed_reference | Web guidance originating in early 2022; reviewed 2026-10-08 |
| EU | eu-nis2 | 19 | requires_review | Directive (EU) 2022/2555, original OJ text of 2022-12-27 |
| IT | it-nis2-decree | 19 | requires_review | Legislative Decree 138/2024, original gazette text effective 2024-10-16 |
| FR | fr-anssi-hygiene | 27 | reviewed_reference | 2017 guide with 42 measures |
| ES | es-ens | 23 | reviewed_reference | Real Decreto 311/2022; BOE consolidation last updated 2024-11-06 |
| NL | nl-ncsc-webapps | 22 | reviewed_reference | May 2024 edition (colophon); official listing dated 2026-04-17 |
| IE | ie-public-baseline | 23 | reviewed_reference | Revision 1, 2022 |
| DK | dk-effective-defence | 18 | reviewed_reference | 6 July 2023 edition, hosted by SAMSIK |
| GR | gr-national-requirements | 20 | requires_review | Joint Ministerial Decision 1689/2025; Gazette B 2186/2025-05-06 |
| RO | ro-nis2-ordinance | 15 | requires_review | OUG 155/2024; available official text with Law 124/2025 amendment notes |
| SE | se-agency-isms | 22 | reviewed_reference | MSBFS 2020:6; current MCF register reviewed 2026-10-08 |
| NO | no-nsm-principles | 0 | requires_review | Version 2.1, published 2024-06-04; updated 2024-10-28 |
| DE | de-compendium-reference | 0 | requires_review | Edition 2023, pinned historical reference; not asserted latest 2026 |
| BE | be-cyfun | 0 | requires_review | CyFun 2025 announcement; technical edition requires retrieval |
| CH | ch-ict-minimum | 0 | requires_review | 2023 ICT minimum standard listed by BACS |
| AT | at-security-framework-bund | 0 | requires_review | Version 2.0; official listing updated 2026-03-09 |
| CZ | cz-minimum-standard | 0 | requires_review | Version 1.2, pinned supporting standard |
| PT | pt-qnrcs | 0 | requires_review | QNRCS 2019, voluntary edition |
| EE | ee-eits | 0 | requires_review | E-ITS 2024 as listed by RIA; applicability needs current-law review |
| TR | tr-information-guide | 0 | requires_review | 2020 guide; 2021 audit guide reference |

`requires_review` is deliberate: an inaccessible current edition, uncertain legal transition or missing sector-specific applicability must remain visible. A historical pinned source is usable for research while that gap prevents a current conformity claim.

## Interpretation decisions

- **Spain ENS:** BÁSICA/MEDIA/ALTA are native system categories selected by the owner from impact dimensions. Annex II sometimes keys a measure to overall category, sometimes to a particular dimension grade. Only explicitly category-based reinforcement mappings are automated here. MEDIA uses semiformal risk analysis; ALTA uses the specified formal analysis. Provider SLAs begin at MEDIA, supply-chain incident-impact assessment at ALTA. Web audits preserve the R1-or-R2 alternative for BÁSICA/MEDIA and R2-plus-R3 for ALTA.
- **France:** the hygiene guide uses standard and reinforced indicators for individual measures. The pack curates standard indicators and leaves reinforced-only annual-audit measure 38 outside this target. These indicators do not become national system grades.
- **Belgium:** Basic/Important/Essential are CyFun assessment tiers, distinct from NIS2 entity classification. The 2025 technical text was not fully retrievable. Legacy Small guidance and 2023 controls were not silently substituted into a 2025 pack.
- **Italy:** national Article 25 expressly includes monthly progress reporting for continuing incidents. Security measures and incident notification can have different transition deadlines; separate applicability facts retain this distinction. Current ACN determinations are not fully mapped, so currency remains requires_review.
- **Romania:** Article 12(5) contains the essential-only 30-day remediation-plan submission after self-assessment. Article 13 includes disposal in lifecycle security. Annual self-assessment requires submission to the proper authority, rather than mere existence of a local checklist. Newer consolidated text and applicable DNSC orders remain a current-review gap.
- **Greece:** essential-only threat-intelligence/vulnerability assessment and independent audit clauses use explicit entity-class predicates. The national list of mandatory approved thematic policies is read from KYA 1689/2025, rather than copied from a generic EU checklist.
- **Sweden:** MSBFS 2020:6 applies to government agencies. Normative ska clauses remain mandatory; general råd/bör text is not promoted. The pack records annual follow-up of the five specified evaluation inputs and calendar-month timing.
- **Ireland:** the left-column numbered requirement supplies the normative status. SHOULD in 2.1.2 and 2.7.4 remains advisory. Guidance notes do not silently upgrade it. Infrastructure patching retains the assessed, approved and applied mitigation alternative.
- **Finland:** internet login services retain MFA-or-block-exposure as an explicit alternative. The one-week critical-update bound belongs to centrally managed endpoints. It is not a universal deadline for every device.
- **Denmark:** six steps describe a defence process. The technical measures are advisory at framework level, even where descriptions use imperative wording. Patch deployment deadlines are set by the organisation; an arbitrary universal number is not inserted.
- **Netherlands:** native U/TV and U/WA clauses retain precise locators for context-dependent output encoding, parameterised queries, session rotation, server expiry and logout invalidation. The PDF colophon states May 2024; `07-24` is retained only in the official filename. High/middle/low labels are guideline priorities, not security grades.
- **EU:** Articles 20–23 are a separate supranational reference. National laws are not inferred from EU membership. Trust-service incident reporting retains its 24-hour exception; ordinary notification uses 72 hours. A calendar month is not converted to 30 days.

## Evidence and source handling

All executable packs have at least 12 individually curated clauses and remain partial. Policy existence, a configuration flag and a complete independent review are different assertions. Risk proportionality, minimum retention, contractual adequacy, management oversight and deadline derogations use manual review where a simple maximum predicate would be misleading.

Applicability facts name real context: public-service status, regulated-entity scope, essential class, external processing, web services, password use, remote access, portable sensitive data, and an obligation being due. Missing context is a gap. These facts must be justified by the operator; their declaration is not an authority determination.

Published dates and entry dates appear only when verified in the cited official source. Other editions are pinned by their document version or official listing, without inventing a publication date. No PDF byte hashes were fabricated. The research session used web text and, where needed, in-memory PDF text extraction from official URLs. Source bytes were not added to the repository.

Source access gaps are explicit for AT, BE, CH, CZ, DE, EE, NO, PT and TR. Their framework records do not contain passable technical packs. Austria's repealed 2019 NISV and Estonia's superseded 2024 decree were excluded as current legal bases. Portugal's 2026 consultation was not treated as an enacted framework.

## Official source ledger

### PL — KRI security requirements

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 20.
- Scope: Entities performing public tasks under the Polish informatization act. Confirm entity and system scope. Register lists repeal on 2027-02-23; this reference is assessed as of 2026-10-08.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [KRI regulation](https://eli.gov.pl/api/acts/DU/2024/773/text.html) — §§19–20.
- [ELI official regulation status](https://eli.gov.pl/eli/DU/2024/773) — Publication, entry into force and repeal metadata.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### FI — NCSC-FI organisational cyber strengthening

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 20.
- Scope: Voluntary guidance for Finnish organisations and companies; does not replace sector legislation.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NCSC-FI strengthening cyber security](https://kyberturvallisuuskeskus.fi/en/instructions-and-guides/instructions-and-guides-organisations-and-companies/strengthening-cyber-security-finnish-organisations-instructions-management-and-experts) — Sections 1–3.10.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### EU — NIS2 directive obligations

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 19.
- Scope: Supranational directive target. National transposition, Articles 2–4 scope/exemptions, sector-specific equivalents and implementing acts must be reviewed independently; selection does not assert any country has enacted these clauses.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NIS 2 directive](https://eur-lex.europa.eu/eli/dir/2022/2555/oj?locale=en) — Articles 2–4,20–23.
- Limit: Directive review does not verify national transposition or sector-specific implementing rules, including Regulation (EU) 2024/2690.

### IT — National NIS2 legislative decree

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 19.
- Scope: Essential and important subjects under national Decree 138/2024. Scope, ACN implementing determinations, individual notification dates and Articles 30–32 transition terms require separate verification before due obligations are assessed.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [Decree 138/2024](https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=24G00155&atto.dataPubblicazioneGazzetta=2024-10-01&elenco30giorni=false) — Articles 23–25;30–32.
- [Decree 138/2024 Article 23](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.codiceRedazionale=24G00155&art.dataPubblicazioneGazzetta=2024-10-01&art.flagTipoArticolo=0&art.idArticolo=23&art.idGruppo=4&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.progressivo=0&art.versione=1) — Article 23, original gazette text.
- [Decree 138/2024 Article 24](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.codiceRedazionale=24G00155&art.dataPubblicazioneGazzetta=2024-10-01&art.flagTipoArticolo=0&art.idArticolo=24&art.idGruppo=4&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.progressivo=0&art.versione=1) — Article 24, original gazette text.
- [Decree 138/2024 Article 25](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.codiceRedazionale=24G00155&art.dataPubblicazioneGazzetta=2024-10-01&art.flagTipoArticolo=0&art.idArticolo=25&art.idGruppo=4&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.progressivo=0&art.versione=1) — Article 25, original gazette text.
- Limit: Pinned original decree clauses. Current ACN implementing determinations and obligation-specific transition deadlines are not fully mapped; source/terms review is required.

### FR — ANSSI information security hygiene

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 27.
- Scope: Public or private organisations with IT administration. Advisory hygiene guide; its standard and reinforced indicators are per-measure targets, not a French national system classification or certificate.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [ANSSI hygiene guide](https://messervices.cyber.gouv.fr/documents-guides/guide_hygiene_informatique_anssi.pdf) — 42 measures; mode d’emploi printed p.3.
- Limit: Only standard indicators are curated. Reinforced-only measures, including measure 38 annual audits, are not silently included in the baseline; standard/renforcé are per-rule guide indicators.

### ES — Esquema Nacional de Seguridad

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 23.
- Scope: Spanish public-sector information systems and providers within ENS scope. Owner determines system category from impact dimensions; individual measures may depend on dimension grades instead of overall category.
- Native target: basica (BÁSICA); media (MEDIA); alta (ALTA). Selection: owner_or_authority.
- [ENS Royal Decree](https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191) — Articles 2,31; Annexes I–II.
- Limit: Category-specific reinforcements are explicit. Dimension-dependent reinforcement tables are not inferred from whole-system category; backup availability-grade refinements and Article 31 audit derogations require separate review.

### NL — NCSC web application security guidelines

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 22.
- Scope: Voluntary technical guidance for web application owners, suppliers and assessors. High/middle/low guideline priority is not a national security grade. Adoption as contract or policy is assessed separately.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NCSC ICT web application security guidelines](https://www.ncsc.nl/api/media/sites/default/files/Richtlijn%20ICT%20beveiligingsrichtlijnen%20webapplicaties%2007-24_0.pdf) — U/TV, U/WA, U/PW and U/NW measures.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### IE — Public Service cyber security baseline

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 23.
- Scope: Irish Public Service Bodies. SHALL/MUST clauses are mandatory within this administrative baseline; SHOULD clauses remain recommendations. Guidance notes are not promoted to requirements.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NCSC Cyber Security Baseline Standards](https://www.ncsc.gov.ie/pdfs/Cyber_Security_Baseline_Standards_Rev_1_2022_Final.pdf) — Identify, Protect, Detect, Respond, Recover; normative left-column clauses.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### DK — Cyberforsvar der virker

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 18.
- Scope: Advisory six-step defence guidance for public agencies and companies. Does not replace government technical minimum requirements or sector obligations. Steps are a process, not security grades.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [SAMSIK/CFCS effective cyber defence](https://samsik.dk/wp-content/uploads/2025/09/vejledning-cyberforsvar-der-virker-2023.pdf) — Step 2 technical measures, pp.7–8; Steps 1–6.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### GR — National cybersecurity requirements framework

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 20.
- Scope: Essential and important entities under Law 5160/2024. Essential-only clauses require confirmed entity class; relevant public-sector implementation provisions and later amendments are separate context.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [KYA 1689/2025 national requirements](https://cyber.gov.gr/wp-content/uploads/2025/05/20250202186.pdf) — Articles 3–11 and subsequent technical requirements.
- Limit: The May 2025 requirements were read directly; later public-sector implementation provisions and current entity-specific timing are not fully mapped.

### RO — Civil national cybersecurity ordinance

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 15.
- Scope: Essential and important entities in the civil national cyberspace under OUG 155/2024. DNSC risk-level orders, registration, sector equivalents and exemptions require separate review. Essential/important denotes entity class, not achievement.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [OUG 155/2024 consolidated text](https://legislatie.just.ro/Public/DetaliiDocument/293121) — Articles 11–14; Law 124/2025 amendment notes.
- Limit: Pinned available official 2025 consolidated clauses. Newer consolidated official view 311690 could not be fully read; current DNSC orders and subsequent amendments remain an explicit review gap.

### SE — Government agency information security rules

- Reviewed: 2026-10-08. Coverage: partial. Pack clauses: 22.
- Scope: Government agencies within MSBFS 2020:6 scope; systematic, risk-based information security. Individual exceptions under §16 require competent authority review. Not a private-sector NIS 2 equivalence claim.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [MCF current register for MSBFS 2020:6](https://www.mcf.se/sv/regler/gallande-regler/msbfs-20206/) — §§1–16.
- [MSBFS 2020:6 normative rules and general guidance](https://www.msb.se/siteassets/dokument/regler/forfattningar/msbfs-2020-6-foreskrifter-om-informationssakerhet-for-statliga-myndigheter.pdf) — §§4–14, printed pp.2–6.
- Limit: Partial mapping; uncovered clauses and independent evidence still require review.

### NO — NSM ICT security principles

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Voluntary recommendations adapted to each organisation. The Norwegian Security Act may require more stringent controls; these principles do not replace those obligations.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NSM ICT security principles 2.1](https://nsm.no/getfile.php/1313975-1717589722/NSM/Filer/Dokumenter/Veiledere/NSMs%20Grunnprinsipper%20for%20IKT-sikkerhet%20v2.1.pdf) — Four principle groups and numbered measures.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### DE — BSI IT-Grundschutz Compendium reference

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: BSI component controls applied to a documented target model. Existing protection-needs and implementation-approach entries remain distinct. Grundschutz++ developments and a newer applicable edition require review.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [BSI IT-Grundschutz Compendium 2023](https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium/IT_Grundschutz_Kompendium_Edition2023.pdf?__blob=publicationFile&v=4) — Edition 2023 components and requirement classes.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### BE — CyberFundamentals assessment tiers

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Belgian organisations selecting CyFun targets, including applicable NIS 2 conformity routes. Basic/Important/Essential are framework assessment tiers; not interchangeable with entity legal class.
- Native target: basic (Basic); important (Important); essential (Essential). Selection: assessment_target.
- [CCB CyFun 2025 announcement](https://ccb.belgium.be/nl/news/cyfunr-2025-nu-beschikbaar) — Edition announcement; current technical framework retrieval gap.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion. Legacy Small guidance is not represented as a certification tier. The 2025 PDF was inaccessible; no 2023 controls silently substituted.

### CH — ICT minimum standard

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: General national ICT guidance, with mandatory application only where a specific sector instrument says so. Electricity/rail sector applicability cannot be imposed on every Swiss organisation.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [BACS ICT minimum standards](https://www.bacs.admin.ch/de/ikt-minimalstandards) — General standard and sector-specific applicability.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### AT — Security Framework Bund

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Austrian federal administration framework with 286 questions across 13 chapters. National handbook and former NISV are separate references; repealed NISV 2019 is not used as current law.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [Federal Chancellery Security Framework Bund](https://www.bundeskanzleramt.gv.at/themen/cybersicherheit/security-framework-bund.html) — Version 2.0 workbook;13 chapters.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### CZ — NUKIB minimum security standard

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Voluntary minimum-security supporting material for organisations; not automatically the current lower- or higher-duty NIS 2 decree. New regulatory applicability is separately determined.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [NUKIB Minimum Security Standard 1.2](https://nukib.gov.cz/download/publikace/podpurne_materialy/minimalni-bezpecnostni-standard_v1.2.pdf) — Sections 2–17.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### PT — National Cybersecurity Reference Framework

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: CNCS voluntary framework for organisations, explicitly organised around Identify/Protect/Detect/Respond/Recover. April 2026 consultation drafts are not represented as enacted risk grades.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [CNCS QNRCS 2019](https://www.cncs.gov.pt/docs/cncs-qnrcs-2019.pdf) — Framework objectives and implementation measures.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### EE — Estonian information security standard

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Organisations applying the national E-ITS baseline and bodies within applicable Estonian obligations. The superseded 2024 decree is not used as current legal authority; no grades inferred from BSI lineage.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [RIA Estonian information security standard](https://ria.ee/kuberturvalisus/riigi-infoturbe-meetmete-haldus/eesti-infoturbestandard-e-its) — Current E-ITS description and implementation/audit references.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

### TR — Information and communication security guide

- Reviewed: 2026-10-08. Coverage: overview_only. Pack clauses: 0.
- Scope: Public agencies and critical-infrastructure organisations under Presidential Circular 2019/12; current 2026 administrative ownership, applicable version and asset criticality levels require review.
- Native target: baseline (Baseline assessment target (no national grade)). Selection: assessment_target.
- [Official information security audit guide](https://ms.hmb.gov.tr/uploads/2021/12/BG_Denetim_Rehberi-1.pdf) — Circular 2019/12 and 2020 guide provenance.
- Limit: Technical clauses or current applicability were not sufficiently retrievable; no executable requirement pack or conformity conclusion.

## Verification performed

- Parsed the batch and all 12 packs with the existing strict catalog and pack validators against an in-memory catalog merge.
- Evaluated empty clause templates at all represented pack levels: 14 targets, all blocked.
- No network scan, exploit executor, credential storage, API call or national certification action was performed.

The root agent owns final catalog merging, source-lock refresh and integration tests.

