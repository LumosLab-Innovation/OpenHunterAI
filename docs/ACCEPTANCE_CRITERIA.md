# ACCEPTANCE_CRITERIA.md - OpenHunterAI

> Dieu kien "lam xong dung" cho v1. Neu chua dat cac tieu chi nay thi khong xem la production-ready.

---

# 1. Global acceptance criteria

V1 dat toi thieu khi:

```text
- User verify domain bang DNS TXT hoac /.well-known file.
- Domain chua verified thi khong scan duoc.
- User tao scan authorization truoc khi scan.
- Free Hunter Snapshot tra report co gia tri va khong co finding board/retest workflow.
- AI Black-hat Check tao reports, findings, finding board va manual retest workflow.
- Authenticated Check ho tro 1-account auth/session mode va 2-account User A/B access-control mode.
- User Approval Gate xuat hien truoc action nhay cam.
- Monitor Basic/Pro la subscription cho history/reminders/manual retest queue, khong auto scan toan app.
- Khong raw password/token/cookie/API key/raw evidence trong logs/report/LLM prompt/storage.
```

---

# 2. Domain verification va blocking

## 2.1. DNS TXT

Dat khi:

```text
- He thong sinh token.
- UI huong dan user them TXT record.
- Backend kiem tra TXT record dung token.
- Neu dung token, domain status = verified.
- Neu sai/khong co record, status van pending/failed.
- Verified domain co verified_at.
- Expired verification khong cho scan.
```

## 2.2. Well-known file

Dat khi:

```text
- He thong sinh token.
- UI huong dan user tao file.
- Backend GET dung path.
- Noi dung file khop token thi verified.
- Chi hostname tuong ung duoc verify.
```

## 2.3. Blocking

Dat khi:

```text
- Domain chua verified khong tao duoc scan job.
- Private/local IP bi reject.
- Metadata endpoint bi reject.
- URL co userinfo/trick parsing bi reject hoac normalize an toan.
- Redirect ngoai scope bi block.
```

---

# 3. Scan authorization va scope

Dat khi:

```text
- User phai tao scan authorization truoc scan.
- Authorization luu allowed_hosts, allowed_paths, excluded_paths, package, consent.
- Scan chi chay tren allowed_hosts.
- Excluded paths khong bi scan/retest.
- Moi scan job co authorization_id.
- Authorization snapshot duoc luu va dung cho in-flight scan/retest.
```

---

# 4. Adversarial Action Model

Dat khi:

```text
- Free chi dung Level 0 Observe, Level 1 Safe Signal, Level 2 Hypothesis.
- AI Black-hat Check co the dung Level 3 Safe Validation trong scope.
- Authenticated Check va sensitive retest co the dung Level 4 Approval-Gated Validation.
- Forbidden actions bi chan: out-of-scope, destructive, credential attack, persistence, evasion, malware, exfiltration.
- Sensitive action khong chay neu chua co User Approval Gate.
```

---

# 5. Test account

Dat khi:

```text
- User them test account voi login_url thuoc verified scope.
- Password/credential duoc ma hoa.
- Raw credential khong xuat hien trong DB plain text, logs, report, LLM/Strix prompt.
- User xoa duoc test account.
- Authenticated Check voi 1 account khong overpromise User A/B access-control.
- Authenticated Check voi 2 accounts bat User A/User B checks neu scope/roles phu hop.
```

---

# 6. Browser observation

Dat khi:

```text
- Worker mo browser context rieng cho moi scan/account.
- Worker capture route/API metadata, cookie attributes, storage key names/token-like indicators, console errors.
- Worker khong navigate ngoai scope.
- Worker co timeout.
- Worker khong persist raw credential, raw cookie jar, raw storage values hoac raw HAR.
- Output la sanitized summary hoac sanitized evidence refs.
```

Free mode dat khi:

```text
- Chay lightweight observation.
- Khong can test account.
- Tra attack surface summary trong Hunter Snapshot Report.
```

Authenticated mode dat khi:

```text
- Login bang test account trong verified scope.
- Capture authenticated context da sanitize.
- Khong leak credential/session secret.
```

---

# 7. ZAP Signal Worker

Dat khi:

```text
- Free chay passive mini hoac equivalent safe mode.
- AI Black-hat/Authenticated chay passive/baseline trong scope.
- Worker co timeout.
- Worker khong chay broad active scan mac dinh.
- Output normalize thanh FindingCandidate hoac coverage gap.
- Tool fail/unavailable thi ghi skipped/failed ro, khong fake success.
```

---

# 8. Nuclei Signal Worker

Dat khi:

```text
- Chi chay internal curated safe templates.
- Khong chay destructive/intrusive/bruteforce/dos/malware/credential-attack templates.
- Co timeout/rate limit.
- Free dung mini-safe profile.
- AI Black-hat/Authenticated dung standard-safe profile.
- Output normalize thanh FindingCandidate hoac coverage gap.
```

---

# 9. OpenHack-style Hunter Workflow

Free report dat khi co output tu mini hunters:

```text
- Vibe-code Exposure Hunter.
- Frontend Secret & Storage Hunter.
- API Surface Hunter.
- Auth/Session Smoke Hunter.
- AI App Smoke Hunter neu phat hien chatbot/LLM.
```

Moi output duoc phan loai thanh:

```text
- Finding
- Warning
- Hardening
- CoverageGap
```

Khong dat neu Free chi tra header/cookie scan don gian ma khong co Hunter Snapshot structure.

---

# 10. Strix Core

## 10.1. Free

Dat khi:

```text
- Free chi dung Strix Mini Summary.
- Strix doc compact sanitized context.
- Output co top observations, risk areas va next steps.
- Khong chay full adversarial reasoning hoac validation action.
```

## 10.2. AI Black-hat Check

Dat khi:

```text
- Strix hypothesis pass tao risk areas va safe validation plan.
- Validation reasoning pass uu tien findings, severity/confidence, remediation, fix prompt, retest scenario.
- Strix khong tu chay sensitive action neu chua qua Product Policy Gate/User Approval Gate.
```

## 10.3. Authenticated Check

Dat khi:

```text
- Strix doc authenticated context da sanitize.
- 1 account mode tap trung auth/session/private-data exposure.
- 2 account mode tap trung User A/User B access-control/BOLA/IDOR suspicion.
- Sensitive access-control validation can User Approval Gate.
```

---

# 11. Reports

## 11.1. Free Hunter Snapshot Report

Dat khi co:

```text
- Snapshot score.
- Top observations.
- Findings/warnings/hardening.
- Public attack surface summary.
- Coverage gaps / what we could not test.
- Recommended next step.
```

Free khong can finding board, AI/dev report, report history hoac retest workflow.

## 11.2. Paid reports

AI Black-hat/Auth reports dat khi co:

```text
- Executive/human summary.
- Scope tested.
- Top risks.
- Severity/confidence.
- Business impact.
- Priority fix plan.
- Sanitized evidence summary.
- AI/dev-readable fix prompt and retest scenario.
- Limitations.
```

Khong report raw credential, raw token/cookie, raw request/response hoac raw private data.

## 11.3. Readiness Report View/Export

Dat khi:

```text
- Chi tao sau AI Black-hat Check hoac Authenticated Check.
- Khong chay scan moi.
- Dung sanitized reports/findings/evidence summaries.
- Khong ghi cam ket he thong an toan tuyet doi.
```

---

# 12. Finding Board

Dat khi:

```text
- Paid checks va Monitor co finding board.
- User xem danh sach/detail findings.
- User loc theo status/severity.
- User doi trang thai In Progress / Ready for Retest / Accepted Risk.
- Finding co severity/confidence/status.
- Finding co sanitized evidence summary.
- Finding co fix suggestion va copy AI fix prompt neu goi ho tro.
- Finding co retest button neu supported va quota/approval cho phep.
```

Free khong dat neu bat buoc user vao full finding board/retest workflow.

---

# 13. Manual Retest va Monitor

Dat khi:

```text
- Retest gan voi finding_id cu the.
- Retest khong scan lai toan bo app.
- Retest kiem tra scope truoc khi chay.
- Retest co timeout.
- Retest ghi audit log.
- Retest cap nhat finding status.
- Monitor Basic/Pro cap quota, reminders va manual retest queue.
- Monitor khong tu retest all findings, khong chay sau deploy, khong CI/CD hook.
```

Ket qua hop le:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

---

# 14. User Approval Gate

Dat khi approval hien truoc action nhay cam:

```text
- action can chay
- domain/path lien quan
- account dung neu co
- rui ro
- dieu se khong thuc hien
- approve/cancel
```

Neu user cancel:

```text
- action khong chay
- audit log ghi denied
```

---

# 15. Production readiness blockers

Khong production-ready neu con:

```text
- scan domain chua verified
- private/local/metadata IP scan duoc
- redirect ngoai scope van bi follow
- raw secret/evidence lo trong log/report/prompt/storage
- worker khong timeout
- report dung mock data trong production
- retest chay ngoai scope
- Strix/sensitive action khong qua policy/approval
- Free report khong co gia tri khi khong thay loi nghiem trong
- docs con old public package names
```

---

# 16. Performance acceptance

Muc tieu ban dau:

```text
- Free Snapshot: 3-10 phut.
- AI Black-hat Check: 20-60 phut.
- Authenticated Check: 45-120 phut.
- Simple manual retest: duoi 1 phut khi scenario deterministic.
```

Neu timeout:

```text
- scan khong treo vo han
- step failed/skipped/coverage gap ro rang
- report neu partial/timeout neu anh huong ket qua
```

---

# 17. LLM Provider Layer acceptance

Dat khi:

```text
- Moi LLM call qua LLM Gateway.
- Business logic khong goi truc tiep provider SDK.
- Provider chon qua model alias/config.
- Prompt Sanitizer chay truoc moi provider call.
- Budget theo package/use case hoat dong.
- Timeout/retry/fallback hoat dong.
- Token/cost/latency log bang metadata an toan.
- Raw password/token/cookie/API key/raw evidence khong xuat hien trong prompt/log/report.
```
