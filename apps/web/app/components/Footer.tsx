'use client';

import { useT } from '../../lib/i18n';

export default function Footer() {
  const t = useT();
  return (
    <footer className="container">
      <nav>
        <a href="/">OpenHunterAI</a>
        <a href="https://github.com/HungBil/OpenHunterAI">{t('footer.github')}</a>
        <a href="https://github.com/HungBil/OpenHunterAI/tree/main/docs">{t('footer.docs')}</a>
        <a href="https://github.com/HungBil/OpenHunterAI/blob/main/docs/SECURITY_GUARDRAILS.md">
          {t('footer.security')}
        </a>
      </nav>
      <small>{t('footer.rule')}</small>
      <small>© {new Date().getFullYear()} OpenHunterAI.</small>
    </footer>
  );
}
