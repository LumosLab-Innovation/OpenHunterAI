# International framework research — 2026-10-08

These entries live in the `ZZ` internal group, with `jurisdictionType: international`.
They do not add a country to the coverage count or define a global security grade.

## OWASP ASVS 5.0.0

- Source: [official release JSON](https://raw.githubusercontent.com/OWASP/ASVS/5cf9b032440be53ce345ab3c130fda46ba1ce7a2/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json).
- Release tag: `v5.0.0_release`; commit `5cf9b032440be53ce345ab3c130fda46ba1ce7a2`.
- SHA-256 of reviewed source: `bcdbec214d70abcfad9284a31d4f9e5134305831d628aad3aa85d7e26626cb35`.
- Native index: 345 requirements. The existing web-assurance planner keeps all IDs in its denominators.
- New clause pack: 37 selected requirements with native minimum levels and cumulative membership. Covers encoding, SQL queries, SSRF, input and upload controls, authentication, authorization, sessions and tokens, OAuth, cryptography, TLS, configuration, sensitive data, suppliers, exceptions and TURN.
- Manual evidence review is required for every selected requirement. Feature applicability remains explicit and exclusions need review. These clauses cannot be verified by a clean scan alone.
- The 37-clause pack and the web-assurance counterevidence mapping have different scopes. Neither represents complete ASVS conformance.
- Attribution and license: OWASP ASVS, CC BY-SA 4.0; this pack contains selected paraphrases and added evidence/applicability metadata. See [third-party notices](../research/THIRD-PARTY-NOTICES.md).

## ISO/IEC 27001:2022 plus Amendment 1:2024

- Primary metadata: [base standard](https://www.iso.org/standard/27001) and [amendment](https://www.iso.org/standard/88435.html).
- Edition and amendment metadata were checked on the review date. Licensed full text was not accessed or reproduced.
- Catalog reference only; no Annex A or exact clause predicates were manufactured from the publication overview.
- `baseline` is an ISMS review target placeholder, not a native security grade or a certification result. Currency is `requires_review`.

## Global research directory

The [UN Statistics Division M49 table](https://unstats.un.org/unsd/methodology/M49) supplies a reviewed snapshot of 248 statistical countries or areas, names, M49 codes and alpha-3 identifiers. It is a directory for tracking research gaps. It supplies no cybersecurity obligations, national security levels or evidence of implementation. Alpha-2 identity joins are separately identified as curated OpenHunter metadata; areas outside this snapshot remain visible.

The [ITU national strategies repository](https://www.itu.int/en/ITU-D/Cybersecurity/pages/national-strategies-repository.aspx) and [Global Cybersecurity Index](https://www.itu.int/epublications/publication/global-cybersecurity-index-2024/) are policy and national readiness context. Their country coverage or tiers are not reused as application or organizational assurance grades.
