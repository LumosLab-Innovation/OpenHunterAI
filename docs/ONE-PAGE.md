# ONE-PAGE.md - OpenHunterAI

## 1. Dinh nghia ngan

**OpenHunterAI** la **Authorized Attacker-Mindset Security Workspace** cho web/app public da xac minh domain. Nguoi dung verify domain, khai bao scope, chay security check co kiem soat, nhan report da sanitize, quan ly findings va manual retest tung loi sau khi sua.

OpenHunterAI khong phai scanner thong thuong va khong phai cong cu tan cong tuy y. San pham mo phong tu duy attacker trong pham vi duoc uy quyen:

```text
Observe → Hypothesize → Safely Validate → Report → Fix → Retest
```

---

## 2. Nguoi dung muc tieu

| Nhom nguoi dung | Nhu cau chinh |
|---|---|
| Founder / chu san pham | Biet app co rui ro lon khong va co report gui dev/khach hang/nha dau tu |
| Vibe coder / AI builder | Check nhanh app build bang AI, co fix prompt va buoc tiep theo ro |
| Dev team nho | Co danh sach loi uu tien, sua va retest tung finding |
| Agency web/app | Kiem tra san pham truoc khi ban giao, co report de chia se |

---

## 3. Scope v1

### V1 lam

```text
- Nhap domain/URL.
- Xac minh quyen so huu domain.
- Khai bao scope va scan authorization.
- Chay Free Hunter Snapshot.
- Chay AI Black-hat Check.
- Chay Authenticated Check neu co test account.
- Tao report tuong ung voi tung goi.
- Tao finding board cho paid checks va Monitor.
- Manual retest tung finding.
- User Approval Gate cho action nhay cam.
- Readiness Report View/Export nhu paid export mode.
- Monitor Basic / Monitor Pro cho history, reminders va manual retest queue.
```

### V1 khong lam

```text
- Khong GitHub repo access.
- Khong Jira / Linear integration.
- Khong CI/CD-based automated retesting.
- Khong deployment-triggered retest.
- Khong VPS/cloud/private network scan.
- Khong server agent.
- Khong mobile APK audit.
- Khong tu sua code.
- Khong Expert Human Review trong v1.
- Khong cam ket tim moi lo hong.
```

---

## 4. Cac lop kiem thu

| Thanh phan | Vai tro |
|---|---|
| Browser Observation | Mo app that, quan sat route, API, cookie, storage, console |
| ZAP passive/baseline signal | Tin hieu DAST nen cho loi web security pho bien |
| Nuclei curated signal | Exposure/misconfig/known pattern bang internal curated templates |
| OpenHack-style workflow | Mini hunters, schema finding/warning/hardening/coverage gap |
| Strix AI reasoning | Attacker hypotheses, severity/confidence, fix/retest plan |
| Product Policy Gate | Kiem soat scope, package, budget, sensitive actions |
| User Approval Gate | User approve truoc action nhay cam |

---

## 5. Adversarial Action Model

| Level | Ten | Goi dung |
|---|---|---|
| 0 | Observe | Free+ |
| 1 | Safe Signal | Free+ |
| 2 | Hypothesis | Free+ |
| 3 | Safe Validation | AI Black-hat Check+ |
| 4 | Approval-Gated Validation | Authenticated Check / sensitive retest |
| Forbidden | Out-of-scope, destructive, credential attack, persistence, evasion, malware, exfiltration | Khong bao gio |

---

## 6. Goi v1

| Goi | Gia tri chinh |
|---|---|
| Free Hunter Snapshot | Report-only snapshot voi browser observation nhe, mini signals, mini hunters va Strix Mini Summary |
| AI Black-hat Check | Paid check chinh voi Strix 2-pass, safe validation, finding board, AI/dev report va manual retest |
| Authenticated Check | Kiem tra sau dang nhap; 1 account cho auth/session, 2 accounts cho User A/B access-control |
| Monitor Basic | Subscription cho 1 project/domain: history, reminders, manual retest queue, quota nho |
| Monitor Pro | Nhieu project/domain, team workspace, longer history, priority retest queue |
| Readiness Report View/Export | Paid export mode sau paid check, khong phai scan moi |

---

## 7. Report va evidence

```text
- Free: Hunter Snapshot Report only.
- AI Black-hat Check: Human Report + AI/dev Report.
- Authenticated Check: Auth Security Report + AI/dev Report.
- Readiness Export: executive/client-facing export tu sanitized summaries.
- Khong persist raw request/response/cookie/token/password.
- Reports phai neu scope, coverage, limitations va next step.
```

Neu khong thay loi nghiem trong, ghi:

```text
Khong phat hien Critical/High trong pham vi kiem thu hien tai.
```

Khong ghi cac ket luan tuyet doi nhu:

```text
Khong co van de nao.
He thong da an toan tuyet doi.
```

---

## 8. Guardrails bat buoc

```text
- No verified ownership / authorization → no scan.
- Khong scan ngoai allowed scope.
- Khong follow redirect ngoai scope.
- Khong scan private/local/metadata IP.
- Khong log raw password/token/cookie/API key.
- Khong dua raw credential/secret vao LLM prompt.
- Khong luu raw evidence.
- Khong destructive action mac dinh.
- Moi LLM call di qua LLM Gateway.
- Retest v1 la manual theo finding, khong phai CI/CD-based automated retesting.
```

---

## 9. Tieu chi v1 dat

```text
- User verify domain bang DNS TXT hoac /.well-known file.
- Free Hunter Snapshot tra report co gia tri nhung khong co board/retest workflow.
- AI Black-hat Check co 2-pass Strix, finding board va manual retest.
- Authenticated Check ho tro 1-account va 2-account mode.
- Monitor Basic/Pro dung nhu subscription workspace, khong auto scan toan app.
- User Approval Gate chan action nhay cam.
- Khong raw secret/evidence trong logs/report/LLM prompt/storage.
- Khong co GitHub/Jira/CI-CD/VPS/cloud/private network trong v1.
```
