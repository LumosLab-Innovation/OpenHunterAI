import './globals.css';
import type { Metadata } from 'next';
import Nav from './components/Nav';
import Footer from './components/Footer';
import { LangProvider } from '../lib/i18n';

export const metadata: Metadata = {
  title: 'OpenHunterAI — AI White-hat Security Workspace',
  description:
    'Authorized web/app security testing: find → understand → fix → retest → prove fixed. ' +
    'Kiểm thử bảo mật web/app có kiểm soát: phát hiện, hiểu, sửa, retest, chứng minh đã xử lý.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <LangProvider>
          <header className="topbar">
            <div className="container">
              <a href="/" className="brand">
                <span className="brand-text">OpenHunterAI</span>
              </a>
              <Nav />
            </div>
          </header>
          <main className="container">{children}</main>
          <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
