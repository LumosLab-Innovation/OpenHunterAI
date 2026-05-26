/**
 * Marketing homepage — Ollama-style (DESIGN.md)
 * PRD: vòng lặp Phát hiện → hiểu → sửa → retest, 5 gói Free/Light/Standard/Auth/Launch.
 * Wording: KHÔNG "100% secure" / "tìm mọi lỗ hổng".
 */
export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────── */}
      <section className="hero">
        <span className="badge">Free Vibe-code Hunter Snapshot</span>
        <h1>
          Security testing<br />
          <span style={{ color: 'var(--brand)' }}>for your verified domain.</span>
        </h1>
        <p className="hero-sub">
          OpenHunterAI đưa bạn qua vòng lặp{' '}
          <strong style={{ color: 'var(--ink)' }}>phát hiện → hiểu → sửa → retest → chứng minh đã xử lý</strong>.
          Không phải header/cookie scanner. Không cài agent. Chỉ kiểm thử trong phạm vi domain đã xác minh.
        </p>

        <span className="snippet">
          <span className="dollar">$</span>
          <span className="cmd">verify domain → choose package → run hunter</span>
        </span>

        <div className="hero-ctas">
          <a href="/register" style={{ textDecoration: 'none' }}>
            <button type="button" style={{ height: 50, fontSize: 16, padding: '0 32px' }}>
              Start Free Hunter Snapshot
            </button>
          </a>
          <a href="/login" style={{ textDecoration: 'none' }}>
            <button type="button" className="secondary" style={{ height: 50, fontSize: 16, padding: '0 32px' }}>
              Sign in
            </button>
          </a>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────── */}
      <div className="feature-grid">
        <div className="card feature">
          <div className="feature-icon">🔍</div>
          <h4>Browser Inspector</h4>
          <p>Mở website bằng browser thật (Playwright). Quan sát API surface, frontend secrets, request/response flow thực tế.</p>
        </div>
        <div className="card feature">
          <div className="feature-icon">🧠</div>
          <h4>Strix Attacker Mindset</h4>
          <p>AI lý luận theo tư duy attacker: phân tích lỗi logic, phân quyền, session, API data exposure.</p>
        </div>
        <div className="card feature">
          <div className="feature-icon">📋</div>
          <h4>Finding Board</h4>
          <p>Bảng quản lý lỗi sau scan: lọc severity, đổi trạng thái, copy AI fix prompt, manual retest từng finding.</p>
        </div>
        <div className="card feature">
          <div className="feature-icon">🔁</div>
          <h4>Manual Retest</h4>
          <p>Retest từng finding cụ thể sau khi sửa — không scan lại toàn bộ. Kết quả: Fixed / Still Vulnerable / Partially Fixed.</p>
        </div>
        <div className="card feature">
          <div className="feature-icon">📄</div>
          <h4>Dual-layer Report</h4>
          <p>Human-readable cho founder/client. AI/dev technical report cho engineer với fix prompt sẵn cho Claude Code, Cursor, Codex.</p>
        </div>
        <div className="card feature">
          <div className="feature-icon">🔒</div>
          <h4>User Approval Gate</h4>
          <p>Mọi action nhạy cảm đều hỏi trước khi thực thi. Không scan ngoài scope. Không bypass auth thực tế.</p>
        </div>
      </div>

      {/* ── Packages ─────────────────────────────── */}
      <section className="card">
        <h3>5 gói theo Hunter Layer</h3>
        <p className="muted">Mỗi gói gắn với một hunter layer cụ thể. Không có Expert Human Review trong v1.</p>
        <table>
          <thead>
            <tr>
              <th>Gói</th>
              <th>Hunter Layer</th>
              <th>Dùng khi nào</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="badge">Free</span></td>
              <td>OpenHack mini + Strix Mini Summary</td>
              <td>Snapshot nhanh, có chất hunter</td>
            </tr>
            <tr>
              <td><span className="badge">Light</span></td>
              <td>OpenHack đầy đủ + limited Strix</td>
              <td>App / MVP / vibe-coded app</td>
            </tr>
            <tr>
              <td><span className="badge">Standard</span></td>
              <td>Strix adversarial core + OpenHack workflow</td>
              <td>Startup chuẩn bị launch / demo</td>
            </tr>
            <tr>
              <td><span className="badge">Auth</span></td>
              <td>Strix access-control + approval package</td>
              <td>Kiểm tra phần sau đăng nhập</td>
            </tr>
            <tr>
              <td><span className="badge">Launch</span></td>
              <td>Strix + OpenHack + readiness package</td>
              <td>Trước launch / demo B2B</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Final CTA ────────────────────────────── */}
      <section style={{
        textAlign: 'center',
        background: 'var(--surface-blue)',
        border: '1px solid rgba(37,99,235,0.15)',
        borderRadius: 'var(--r-xl)',
        padding: '56px var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-lg)',
      }}>
        <h2 style={{ maxWidth: 520 }}>Sẵn sàng chạy Hunter Snapshot đầu tiên?</h2>
        <p style={{ maxWidth: 480, color: 'var(--charcoal)' }}>
          Tạo workspace, xác minh domain bạn được phép kiểm thử, và nhận báo cáo có chất hunter.
          Khi không phát hiện lỗi nghiêm trọng, report vẫn ghi rõ đã kiểm tra gì, coverage, và bước tiếp theo.
        </p>
        <a href="/register" style={{ textDecoration: 'none' }}>
          <button type="button" style={{ height: 50, fontSize: 16, padding: '0 40px' }}>
            Tạo workspace miễn phí
          </button>
        </a>
      </section>
    </>
  );
}
