import './globals.css';
import type { Metadata } from 'next';
import Nav from './components/Nav';

export const metadata: Metadata = {
  title: 'OpenHunterAI — AI White-hat Security Workspace',
  description:
    'Kiểm thử bảo mật web/app có kiểm soát: phát hiện rủi ro, hiểu lỗi, sửa lỗi, retest, chứng minh đã xử lý.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <header className="topbar">
          <div className="container">
            <a href="/" className="brand">
              <img src="/logo.png" alt="OpenHunterAI" />
            </a>
            <Nav />
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="container">
          <small>
            Quy tắc cứng: chỉ scan domain đã xác minh quyền sở hữu. Không scan private/local IP.
            Không bypass auth thực tế. Không hứa "100% secure".
          </small>
        </footer>
      </body>
    </html>
  );
}
