'use client';

/**
 * Tiny i18n for the OpenHunterAI dashboard. Keeps the marketing surface
 * + auth pages bilingual (VN/EN) without pulling in a heavy framework.
 *
 * Source of truth lives here, in one dictionary, so the UI strings stay
 * close to the components that render them.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'vi' | 'en';

type Entry = { vi: string; en: string };
type Dict = Record<string, Entry>;

export const messages = {
  // Topbar / nav
  'nav.docs': { vi: 'Tài liệu', en: 'Docs' },
  'nav.pricing': { vi: 'Gói', en: 'Pricing' },
  'nav.github': { vi: 'GitHub', en: 'GitHub' },
  'nav.signin': { vi: 'Đăng nhập', en: 'Sign in' },
  'nav.cta': { vi: 'Tạo workspace', en: 'Create workspace' },
  'nav.signout': { vi: 'Đăng xuất', en: 'Sign out' },
  'nav.projects': { vi: 'Projects', en: 'Projects' },
  'nav.scans': { vi: 'Scans', en: 'Scans' },
  'nav.findings': { vi: 'Findings', en: 'Findings' },

  // Hero
  'hero.eyebrow': {
    vi: 'Free Vibe-code Hunter Snapshot',
    en: 'Free Vibe-code Hunter Snapshot',
  },
  'hero.title.line1': {
    vi: 'Cách đơn giản nhất để',
    en: 'The simplest way to',
  },
  'hero.title.line2': {
    vi: 'hunt lỗ hổng trên domain bạn được phép.',
    en: 'hunt vulnerabilities on a domain you own.',
  },
  'hero.subtitle': {
    vi: 'Phát hiện → hiểu → sửa → retest → chứng minh đã xử lý. Không phải header-scanner. Không cài agent. Chỉ kiểm thử trong phạm vi domain đã xác minh.',
    en: 'Find → understand → fix → retest → prove fixed. Not a header scanner. No agents to install. Only scans domains you have proven ownership of.',
  },
  'hero.snippet.command': {
    vi: 'verify domain → choose package → run hunter',
    en: 'verify domain → choose package → run hunter',
  },
  'hero.cta.primary': { vi: 'Tạo workspace miễn phí', en: 'Create free workspace' },
  'hero.cta.secondary': { vi: 'Đăng nhập', en: 'Sign in' },

  // Automate-your-work block
  'block.automate.title': {
    vi: 'Tự động hoá quy trình hunter của bạn',
    en: 'Automate your hunter workflow',
  },
  'block.automate.body': {
    vi: 'Browser Inspector chạy bằng Playwright thật. ZAP passive baseline. Nuclei safe templates. OpenHack mini hunter và Strix attacker-mindset reasoning — tất cả gắn vào cùng một scope đã được xác minh.',
    en: 'Browser Inspector runs real Playwright. ZAP passive baseline. Nuclei safe templates. OpenHack mini-hunter and Strix attacker-mindset reasoning — all tied to the same verified scope.',
  },

  // Start local / scale cloud (packages overview)
  'block.packages.title': {
    vi: '5 gói theo Hunter Layer',
    en: '5 packages, one Hunter Layer each',
  },
  'block.packages.body': {
    vi: 'Mỗi gói gắn với một hunter layer cụ thể. Không có Expert Human Review trong v1.',
    en: 'Each package maps to a specific hunter layer. No Expert Human Review in v1.',
  },

  'pkg.free.title': { vi: 'Free', en: 'Free' },
  'pkg.free.tag': {
    vi: 'OpenHack mini + Strix Mini Summary',
    en: 'OpenHack mini + Strix Mini Summary',
  },
  'pkg.free.use': {
    vi: 'Snapshot nhanh, có chất hunter',
    en: 'Quick snapshot with real hunter signal',
  },

  'pkg.light.title': { vi: 'Light', en: 'Light' },
  'pkg.light.tag': { vi: 'OpenHack đầy đủ + limited Strix', en: 'Full OpenHack + limited Strix' },
  'pkg.light.use': { vi: 'App / MVP / vibe-coded app', en: 'App / MVP / vibe-coded app' },

  'pkg.standard.title': { vi: 'Standard', en: 'Standard' },
  'pkg.standard.tag': {
    vi: 'Strix adversarial core + OpenHack workflow',
    en: 'Strix adversarial core + OpenHack workflow',
  },
  'pkg.standard.use': {
    vi: 'Startup chuẩn bị launch / demo',
    en: 'Startup preparing to launch / demo',
  },

  'pkg.auth.title': { vi: 'Auth', en: 'Auth' },
  'pkg.auth.tag': {
    vi: 'Strix access-control + approval package',
    en: 'Strix access-control + approval package',
  },
  'pkg.auth.use': { vi: 'Kiểm tra phần sau đăng nhập', en: 'Test post-login behaviour' },

  'pkg.launch.title': { vi: 'Launch', en: 'Launch' },
  'pkg.launch.tag': {
    vi: 'Strix + OpenHack + readiness package',
    en: 'Strix + OpenHack + readiness package',
  },
  'pkg.launch.use': { vi: 'Trước launch / demo B2B', en: 'Before launch / B2B demo' },

  // Data privacy section
  'block.privacy.title': { vi: 'Dữ liệu của bạn vẫn là của bạn', en: 'Your data stays yours' },
  'block.privacy.body': {
    vi: 'Mọi evidence đều đi qua sanitizer trước khi vào report, log hay LLM prompt. Cookie, header nhạy cảm, JWT, API key prefix, email và blob hex/base64 dài đều được masked.',
    en: 'Every piece of evidence is sanitized before it reaches a report, a log line or an LLM prompt. Cookies, sensitive headers, JWTs, API-key prefixes, emails and long hex/base64 blobs are masked.',
  },

  // Final CTA
  'block.final.title': {
    vi: 'Sẵn sàng chạy Hunter Snapshot đầu tiên?',
    en: 'Ready to run your first Hunter Snapshot?',
  },
  'block.final.body': {
    vi: 'Tạo workspace, xác minh domain bạn được phép kiểm thử, và nhận báo cáo có chất hunter. Khi không phát hiện lỗi nghiêm trọng, report vẫn ghi rõ đã kiểm tra gì, coverage, và bước tiếp theo.',
    en: 'Create a workspace, verify a domain you are allowed to test, and receive a report with real hunter signal. When nothing critical is found, the report still spells out what was checked, the coverage, and the next steps.',
  },
  'block.final.cta': { vi: 'Tạo workspace miễn phí', en: 'Create free workspace' },

  // Login
  'login.title': { vi: 'Đăng nhập', en: 'Sign in' },
  'login.subtitle': {
    vi: 'Đăng nhập vào workspace kiểm thử bảo mật của bạn.',
    en: 'Sign in to your security testing workspace.',
  },
  'login.email': { vi: 'email@example.com', en: 'email@example.com' },
  'login.password': { vi: 'Mật khẩu', en: 'Password' },
  'login.submit': { vi: 'Đăng nhập', en: 'Sign in' },
  'login.submitting': { vi: 'Đang đăng nhập…', en: 'Signing in…' },
  'login.noaccount': { vi: 'Chưa có tài khoản?', en: "Don't have an account?" },
  'login.create': { vi: 'Tạo workspace mới', en: 'Create workspace' },
  'login.error.network': {
    vi: 'Không thể kết nối tới API. Kiểm tra API_BASE_URL hoặc đảm bảo API server đang chạy ở cổng 4000.',
    en: 'Could not reach the API. Check API_BASE_URL or make sure the API server is running on port 4000.',
  },

  // Register
  'register.title': { vi: 'Tạo workspace', en: 'Create workspace' },
  'register.subtitle': {
    vi: 'Tạo tài khoản và tổ chức để bắt đầu Free Vibe-code Hunter Snapshot.',
    en: 'Create an account and organization to start the Free Vibe-code Hunter Snapshot.',
  },
  'register.orgName': { vi: 'Tên tổ chức (vd: ShopX)', en: 'Organization name (e.g. ShopX)' },
  'register.displayName': {
    vi: 'Tên hiển thị (tuỳ chọn)',
    en: 'Display name (optional)',
  },
  'register.password.placeholder': {
    vi: 'mật khẩu (≥ 8 ký tự)',
    en: 'password (≥ 8 chars)',
  },
  'register.password.short': {
    vi: 'Mật khẩu phải có ít nhất 8 ký tự.',
    en: 'Password must be at least 8 characters.',
  },
  'register.submit': { vi: 'Tạo workspace', en: 'Create workspace' },
  'register.submitting': { vi: 'Đang tạo…', en: 'Creating…' },
  'register.disclaimer': {
    vi: 'Bằng việc tạo tài khoản, bạn xác nhận sẽ chỉ kiểm thử các domain mà bạn được phép — không phát hiện Critical/High không có nghĩa là an toàn tuyệt đối.',
    en: 'By creating an account you confirm you will only test domains you are authorized for — no Critical/High findings does not mean absolute safety.',
  },
  'register.haveaccount': { vi: 'Đã có tài khoản?', en: 'Already have an account?' },

  // Footer
  'footer.rule': {
    vi: 'Quy tắc cứng: chỉ scan domain đã xác minh quyền sở hữu. Không scan private/local IP. Không bypass auth thực tế. Không hứa "100% secure".',
    en: 'Hard rule: only scan domains with verified ownership. No private/local IP scanning. No real-auth bypass. No "100% secure" promises.',
  },
  'footer.docs': { vi: 'Tài liệu', en: 'Docs' },
  'footer.security': { vi: 'Quy tắc bảo mật', en: 'Security rules' },
  'footer.pricing': { vi: 'Gói', en: 'Pricing' },
  'footer.github': { vi: 'GitHub', en: 'GitHub' },
} as const satisfies Dict;

export type MessageKey = keyof typeof messages;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangCtx = createContext<Ctx>({ lang: 'vi', setLang: () => undefined });

const STORAGE_KEY = 'ohai_lang';

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('vi');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'vi' || saved === 'en') {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
          document.documentElement.lang = next;
        } catch {
          /* ignore */
        }
      },
    }),
    [lang],
  );

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang(): Ctx {
  return useContext(LangCtx);
}

export function useT(): (key: MessageKey, fallback?: string) => string {
  const { lang } = useLang();
  return (key, fallback) => messages[key]?.[lang] ?? fallback ?? String(key);
}
