# PRD.md - OpenHunterAI

> PRD nay mo ta feature, user flow, goi dich vu, trai nghiem nguoi dung va tieu chi hoan thanh o muc san pham.
> PRD khong mo ta chi tiet worker, database, provider, Docker image hay task ky thuat.
> Dinh vi public: **OpenHunterAI - Authorized Attacker-Mindset Security Workspace**.

---

# 1. Tong quan san pham

## 1.1. Ten san pham

**OpenHunterAI**

## 1.2. Mo ta ngan

OpenHunterAI la workspace kiem thu bao mat web/app public da xac minh domain. San pham mo phong tu duy attacker trong pham vi duoc uy quyen, thu thap tin hieu an toan, tao gia thuyet rui ro, chay validation co kiem soat, roi tra report, finding board va manual retest cho tung loi sau khi sua.

## 1.3. Dinh vi

OpenHunterAI khong phai scanner thong thuong va khong phai cong cu tan cong tuy y.

```text
Authorized attacker-mindset testing
→ evidence-based findings
→ fix guidance
→ manual retest
→ prove fixed
```

Trong PRD nay, "black-hat mindset" nghia la mo phong cach doi thu suy nghi: dat gia thuyet tan cong, tim abuse path, nghi ngo phan quyen, soi API behavior, session flow va cac rui ro khong hien nhien.

No khong co nghia la tan cong trai phep. Moi execution deu bi gioi han boi verified domain, scan authorization, Product Policy Gate, User Approval Gate, budget/runtime limits va evidence sanitization.

## 1.4. Gia tri cot loi

```text
- Free van co chat hunter, khong chi check header/cookie.
- Goi tra phi dung attacker-mindset de tim rui ro logic, phan quyen, API behavior va session flow kho thay.
- Moi goi dung nhieu lop kiem thu: browser observation, scanner signals, hunter workflow va AI reasoning o muc phu hop.
- Moi goi deu co report; khac nhau o do sau, muc ky thuat, evidence summary va kha nang export.
- Finding board va Monitor giup quan ly loi sau scan.
- Manual retest kiem tra lai tung finding, khong scan lai toan bo app.
```

---

# 2. Nguoi dung muc tieu

## 2.1. Founder / chu san pham

```text
- Muon biet web/app co rui ro lon khong.
- Muon hieu loi bang ngon ngu de hieu.
- Muon biet loi nao can sua truoc.
- Muon co report de gui dev, khach hang hoac nha dau tu.
```

## 2.2. Vibe coder / AI builder

```text
- Build nhanh bang AI nen de thieu security foundation.
- Muon check nhanh loi pho bien va rui ro dang chu y.
- Muon co fix prompt dua cho AI coding agent hoac dev.
- Muon retest sau khi sua.
```

## 2.3. Dev team nho / agency

```text
- Can danh sach loi ro rang.
- Can report ban giao khach hang.
- Can workflow quan ly loi toi gian.
- Khong can Jira/DevSecOps phuc tap trong v1.
```

---

# 3. Scope san pham v1

## 3.1. V1 lam gi

```text
- Nhap domain/URL.
- Xac minh quyen so huu domain.
- Khai bao pham vi kiem thu.
- Chay Free Hunter.
- Chay AI Black-hat Mindset Check.
- Cho phep bat Authenticated Scope trong AI Black-hat Mindset Check neu user cung cap test account.
- Them/xoa test account.
- Hien thi tien trinh kiem thu de hieu.
- Tra report tuong ung voi tung goi.
- Co Monitor Workspace cho report history, monitored findings, reminders va manual retest queue.
- Co Enterprise / PAYG cho nhieu domain, nhieu scan, nhieu monitored findings, nhieu retest hoac custom usage.
- Cho phep user doi trang thai finding.
- Cho phep manual retest tung finding.
- Co User Approval Gate cho action nhay cam.
- Co Readiness Report View/Export nhu report/export mode, khong phai scan package rieng.
```

## 3.2. V1 khong lam gi

```text
- Khong GitHub repo access.
- Khong Jira / Linear integration.
- Khong CI/CD-based automated retesting.
- Khong tu chay scan sau moi lan deploy.
- Khong xac minh VPS / cloud account.
- Khong scan private network.
- Khong cai server agent.
- Khong mobile APK audit.
- Khong tu sua code.
- Khong Expert Human Review trong v1.
- Khong cam ket tim moi lo hong.
```

---

# 4. Lop kiem thu va adversarial action model

## 4.1. Cac lop kiem thu

| Lop | Vai tro trong san pham | Cach noi voi user |
|---|---|---|
| Browser Observation | Mo app that, quan sat route, request/API, cookie, storage, console | "Mo website bang browser that" |
| ZAP passive/baseline signal | Tin hieu DAST nen cho loi web security pho bien | Khong can nhan manh ten tool |
| Nuclei curated signal | Kiem tra exposure/misconfig/known pattern bang template noi bo da chon loc | Khong can nhan manh ten tool |
| OpenHack-style hunter workflow | To chuc mini hunter, schema finding/warning/hardening/coverage gap | Khong can nhan manh ten repo |
| Strix AI reasoning | Tao attacker hypotheses, uu tien finding, tao fix/retest plan | "AI mo phong tu duy attacker trong scope da xac minh" |

## 4.2. Adversarial Action Model

OpenHunterAI co attacker-mindset, nhung execution luon nam trong verified scope va policy gate.

| Level | Ten | Duoc dung cho | Mo ta |
|---|---|---|---|
| 0 | Observe | Free+ | Browser observation, route/API discovery, cookie/storage metadata, console signals. |
| 1 | Safe Signal | Free+ | ZAP passive/baseline, Nuclei curated safe templates, exposure checks. |
| 2 | Hypothesis | Free+ | Strix/OpenHack tao risk hypothesis tu compact sanitized context. |
| 3 | Safe Validation | AI Black-hat Mindset Check+ | Benign validation trong scope, khong destructive, khong exfiltrate raw data. |
| 4 | Approval-Gated Validation | Authenticated Scope / sensitive retest | Access-control, POST/PUT/PATCH/DELETE, billing/file/email/webhook, High/Critical retest; can User Approval Gate. |
| Forbidden | Khong bao gio | Tat ca goi | Out-of-scope scan, destructive action, credential attack, persistence, evasion, malware, exfiltration, raw secret logging/reporting. |

## 4.3. Nuclei

Nuclei khong dung de check codebase. V1 chi dung:

```text
Nuclei engine + internal curated templates
```

Khong dung:

```text
full nuclei-templates repo chay mac dinh
```

---

# 5. Cau truc goi v1

| Goi | Muc dich | Gioi han / loi ich chinh |
|---|---|---|
| Free Hunter | Chung minh nang luc that cua OpenHunterAI | Chay engine tot, model tot, dung o first valuable finding, report day du cho 1 finding, monitor 1 finding, 1 retest, cooldown 7 ngay |
| AI Black-hat Mindset Check | Goi tra phi scan chinh | Nhieu hypothesis hon, nhieu finding hon, nhieu validation attempt hon, Human Report, AI/dev Report, finding board, nhieu retest hon |
| Monitor Workspace | Goi thang giu chan | Theo doi nhieu findings, report history, reminders, retest quota, security trend, quan ly loi sau scan |
| Enterprise / PAYG | B2B/agency/nhieu domain | Tra theo domain/scan/finding/retest/escalation/custom quota, khong ban unlimited |

Authenticated Scope la mode ben trong AI Black-hat Mindset Check hoac Enterprise, khong phai goi public rieng.
Readiness Report View/Export la che do trinh bay/export report, khong phai goi scan rieng.

## 5.2. Readiness Report View/Export

Day la paid export mode, khong phai goi scan rieng.

```text
- Chi dung sau AI Black-hat Mindset Check hoac Authenticated Scope.
- Khong chay scan moi.
- Tao executive/client-facing export tu sanitized reports/findings.
- Khong bao gom Expert Human Review trong v1.
- Khong bao chung rang he thong an toan tuyet doi.
```

---

# 6. Report model

## 6.1. Nguyen tac

```text
- Moi goi scan deu co report.
- Free co report cho first valuable finding hoac coverage report neu khong tim thay.
- AI Black-hat Mindset Check va Authenticated Scope co report ky thuat cho AI/dev.
- Readiness Export chi dung sanitized report/finding/evidence summaries.
- Raw request/response/cookie/token/password khong duoc luu hoac dua vao report.
```

## 6.2. Report theo goi

| Goi | Report | Noi dung chinh |
|---|---|---|
| Free Hunter | First Valuable Finding Report / Coverage Report | 1 valuable finding neu co, severity/confidence, remediation, 1 monitored slot, 1 retest, coverage gaps |
| AI Black-hat Mindset Check | Human-readable Report + AI/dev-readable Report | Findings, severity/confidence, impact, fix guidance, fix prompt, retest scenario |
| Authenticated Scope | Auth Security Report + AI/dev-readable Report | Session/auth/access-control findings, User A/User B observations, sensitive flows, retest plan |
| Readiness Report View/Export | Executive/Client-facing export | Executive summary, readiness summary, priority fix plan, sanitized evidence summary |

## 6.3. Wording bat buoc

Khong ghi cac ket luan tuyet doi nhu:

```text
Khong co van de nao.
He thong da an toan tuyet doi.
```

Ghi:

```text
Khong phat hien Critical/High trong pham vi kiem thu hien tai.
```

Va luon kem:

```text
- scope;
- coverage;
- limitations;
- what we could not test;
- recommended next step.
```

---

# 7. Free Hunter

## 7.1. Muc tieu

Free phai co gia tri that va co chat hunter, nhung khong phai pentest day du va khong co full adversarial validation.

## 7.2. Bao gom

```text
- Domain verification.
- Lightweight browser observation.
- ZAP passive mini signal.
- Nuclei internal mini-safe signal.
- Mini exposure hunter.
- Frontend secret/storage hunter.
- API surface hunter.
- Auth/session smoke hunter.
- AI app smoke hunter neu phat hien chatbot/LLM.
- First valuable finding limit.
- Dung scan sau khi phat hien 1 finding du gia tri.
- Report day du cho finding do.
- Monitor 1 finding.
- 1 retest cho finding do.
- Neu muon check finding moi: cho cooldown 7 ngay hoac nang goi.
- Neu muon monitor finding khac trong Free: phai xoa monitor finding cu hoac nang goi.
```

## 7.3. Khong bao gom

```text
- Full paid finding board.
- Monitor nhieu findings.
- Retest nhieu findings.
- Full adversarial depth.
- Authenticated Scope.
- Multi-account User A/User B access-control test.
- Deep business logic testing.
- Expert Human Review.
- CI/CD-based automated retesting.
```

---

# 8. AI Black-hat Mindset Check

## 8.1. Muc tieu

Goi tra phi chinh cho web/app public da xac minh domain. Goi nay dung attacker-mindset de tim rui ro sau hon Free nhung van nam trong scope an toan.

## 8.2. Bao gom

```text
- Toan bo tin hieu Free nhung sau hon.
- Browser observation nhieu route/API hon.
- ZAP/Nuclei standard-safe signals.
- OpenHack schema/workflow de chuan hoa finding/report/retest.
- Strix 2-pass reasoning:
  1. hypothesis pass de tao risk areas va validation plan;
  2. validation reasoning pass de uu tien finding, severity, remediation va retest scenario.
- Safe validation trong scope.
- Human-readable report.
- AI/dev-readable technical report.
- Fix prompt cho AI/dev.
- Finding board.
- Manual retest tung finding.
- User Approval Gate cho action nhay cam.
```

## 8.3. Khong bao gom

```text
- Authenticated access-control check neu user khong cung cap test account.
- Multi-account User A/User B check.
- Expert Human Review.
- CI/CD-based automated retesting.
```

---

# 9. Authenticated Scope trong AI Black-hat Mindset Check

## 9.1. Muc tieu

Authenticated Scope khong phai goi public rieng. Day la mode kiem thu sau dang nhap trong AI Black-hat Mindset Check hoac Enterprise/PAYG.

Kiem tra rui ro sau dang nhap: session, role, access-control, API data exposure, BOLA/IDOR suspicion.

## 9.2. Mode theo test account

```text
- 1 test account: authenticated observation, auth/session checks, private data exposure signals, admin-like endpoint visibility.
- 2 test accounts: bat User A/User B access-control checks, BOLA/IDOR suspicion va safe validation.
```

## 9.3. Yeu cau dau vao

```text
- Domain da xac minh.
- Scope da khai bao.
- It nhat 1 test account.
- Tot nhat 2 test accounts: User A / User B.
- Role label neu user biet: normal, admin, editor, viewer...
```

## 9.4. Bao gom

```text
- Toan bo AI Black-hat Mindset Check.
- Authenticated browser observation.
- Session/cookie/token checks.
- Role boundary checks neu co role.
- User A/User B access-control checks neu co 2 accounts.
- BOLA/IDOR suspicion and safe validation.
- Auth Security Report.
- AI/dev-readable technical report.
- User Approval Gate bat buoc cho action nhay cam.
- Manual retest cho access-control finding.
```

## 9.5. Khong bao gom

```text
- Expert Human Review.
- Scan ngoai scope.
- Destructive action mac dinh.
- CI/CD-based automated retesting.
```

---

# 10. Monitor Workspace

## 10.1. Nguyen tac

Monitor la subscription sau scan, khong phai CI/CD hay auto full scan.

```text
- report/finding history;
- monitored findings;
- reminders;
- manual retest queue;
- retest quota;
- security trend;
- risk acceptance.
```

Monitor Workspace co the co quota tier noi bo, nhung public package model chi goi la Monitor Workspace.

---

# 11. User flow

## 11.1. Tao project va verify domain

```text
1. User tao project.
2. User nhap domain.
3. He thong hien thi DNS TXT hoac /.well-known verification.
4. User hoan tat verify.
5. Domain chuyen sang Verified.
6. User tao scan authorization va moi duoc chay scan.
```

## 11.2. Free Hunter

```text
1. User chon Free Hunter.
2. User xac nhan scope co ban.
3. He thong chay browser observation nhe + ZAP/Nuclei mini signals + OpenHack mini hunter.
4. DeepSeek V4 Flash loc nhieu va xep hang suspicious surfaces.
5. DeepSeek V4 Pro phan tich top evidence de tim first valuable finding.
6. Neu co 1 valuable finding:
   - dung scan;
   - tao report day du cho finding do;
   - tao 1 monitored finding slot;
   - cap 1 retest cho finding do.
7. Neu chua co valuable finding trong budget:
   - tra coverage report + hardening + limitations.
8. User duoc goi y nang len AI Black-hat Mindset Check hoac Enterprise/PAYG neu can kiem tra tiep.
```

## 11.3. AI Black-hat Mindset Check

```text
1. User chon AI Black-hat Mindset Check.
2. User xac nhan scope.
3. He thong chay signal gathering.
4. DeepSeek V4 Pro tao hypothesis va safe validation plan.
5. He thong chay safe validation trong scope.
6. Neu action nhay cam, User Approval Gate hien ra truoc khi chay.
7. User nhan Human Report va AI/dev Report.
8. User quan ly finding trong board va manual retest tung finding.
```

## 11.4. Authenticated Scope

```text
1. User bat Authenticated Scope trong AI Black-hat Mindset Check hoac Enterprise/PAYG.
2. User them 1 hoac 2 test accounts.
3. He thong login trong verified scope.
4. 1 account bat auth/session checks.
5. 2 accounts bat User A/User B access-control checks.
6. Action nhay cam phai co User Approval Gate.
7. User nhan Auth Security Report va AI/dev Report.
8. User manual retest tung access-control finding.
```

## 11.5. Monitor

```text
1. User co reports/findings tu paid check.
2. User chon Monitor Workspace.
3. He thong luu history, reminders va retest quota.
4. User mark Ready for Retest hoac queue retest tung finding.
5. He thong chay retest hep theo finding va cap nhat status.
```

---

# 12. Feature requirements

## 12.1. Domain Verification

```text
- Them domain.
- Verify bang DNS TXT hoac /.well-known file.
- Xem status pending/verified/failed/expired.
- Domain chua verified thi khong scan duoc.
```

## 12.2. Scope Setup

```text
- Chon allowed host.
- Loai tru path nhay cam.
- Chon goi scan.
- Xac nhan co quyen kiem thu.
```

## 12.3. Test Account Setup

```text
- Them test account trong verified scope.
- Gan role neu biet.
- Them User A/User B neu muon check access-control.
- Xoa test account.
- Test account chi dung trong pham vi domain da xac minh.
```

## 12.4. Finding Board

Finding board bat buoc cho AI Black-hat Mindset Check, Authenticated Scope va Monitor Workspace. Free co limited finding view cho 1 monitored finding, khong phai full paid finding board.

```text
- Xem findings.
- Loc theo status/severity.
- Mo finding detail.
- Copy fix prompt.
- Doi trang thai.
- Queue manual retest neu goi ho tro.
```

States:

```text
Open
In Progress
Ready for Retest
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
Accepted Risk
```

## 12.5. Manual Retest

```text
- Theo tung finding.
- Khong scan lai toan bo app.
- Khong chay sau deploy.
- Kiem tra scope truoc khi chay.
- Co User Approval Gate neu action nhay cam.
```

Ket qua:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

---

# 13. UX wording

Khong dung cac claim marketing tuyet doi hoac imply tan cong tuy y.

Dung:

```text
Authorized attacker-mindset testing.
AI mo phong tu duy attacker trong scope da xac minh.
Khong phat hien Critical/High trong pham vi kiem thu hien tai.
```

---

# 14. Success metrics

```text
- Free Snapshot completion rate.
- Free → paid conversion.
- Ty le user bat Authenticated Scope sau Free.
- Ty le user them test account sau Free.
- So report duoc export.
- So finding duoc mark Ready for Retest.
- So retest duoc queue/chay.
- Ty le finding chuyen Fixed.
- Monitor subscription conversion.
```

---

# 15. Acceptance summary o muc san pham

PRD v1 dat khi:

```text
- User tao project, them domain va verify domain.
- Domain chua verified thi khong scan duoc.
- Free Hunter dung cung workflow chat luong cao nhung gioi han o first valuable finding.
- Free Hunter tao report cho finding do, monitor 1 finding va cho 1 retest gioi han.
- Free khong mo full paid finding board/retest workflow.
- AI Black-hat Mindset Check co hypothesis loop, safe validation, finding board, AI/dev report va manual retest.
- Authenticated Scope la mode ben trong AI Black-hat Mindset Check hoac Enterprise, khong phai public package rieng.
- Monitor Workspace la mot public package, khong tach Basic/Pro trong PRD public.
- Khong raw evidence trong storage/report/LLM prompt.
- User Approval Gate hoat dong cho action nhay cam.
```

Khong dat neu:

```text
- Free chi la header/cookie scan don gian.
- Free bi mo full board/retest nhu paid.
- Free khong gioi han first valuable finding.
- Report tra ket luan tuyet doi ma khong co coverage/limitation.
- Authenticated Scope bi trinh bay nhu public package rieng.
- Monitor quota tiers bi trinh bay nhu public package chinh.
- Docs lam lech black-hat mindset thanh checklist scanner/compliance audit.
- Monitor bi hieu la CI/CD/deployment-triggered/fully automated scanner.
- Authenticated Scope hua User A/B khi chi co 1 account.
- PRD lam nguoi doc hieu OpenHunterAI la cong cu tan cong tuy y.
```
