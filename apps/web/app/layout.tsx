import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'X-hunter AI',
  description: 'AI White-hat Security Workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="topbar">
          <div className="container">
            <strong>X-hunter AI</strong>
            <span className="muted"> · authorized white-hat security workspace</span>
            <nav style={{ marginLeft: 'auto' }}>
              <a href="/">Projects</a>
              <a href="/scans">Scans</a>
              <a href="/findings">Findings</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="container muted">
          <small>
            Quy tắc cứng: chỉ scan domain đã xác minh quyền sở hữu. Không scan private/local IP.
            Không bypass auth thực tế.
          </small>
        </footer>
      </body>
    </html>
  );
}
