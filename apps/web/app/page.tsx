'use client';

/**
 * Marketing homepage — implements docs/DESIGN.md (Ollama-faithful layout).
 *
 *   • paper-white canvas, pure-black CTA, pill geometry
 *   • centred 720px hero with install-snippet pill (DESIGN.md §Hero)
 *   • terminal mockup card with macOS traffic-light dots
 *   • 5 packages (Free/Light/Standard/Auth/Launch); only Launch is inverted-dark
 *     — the single attention-grabbing surface allowed by DESIGN.md §Colors
 *
 * All copy is bilingual VN/EN through the in-app i18n.
 */

import { useT, type MessageKey } from '../lib/i18n';

export default function HomePage() {
  const t = useT();

  return (
    <>
      {/* ── Hero ─────────────────────────────────── */}
      <section className="hero">
        <span className="eyebrow">{t('hero.eyebrow')}</span>
        <h1>
          {t('hero.title.line1')}
          <br />
          {t('hero.title.line2')}
        </h1>
        <p className="hero-sub">{t('hero.subtitle')}</p>

        <span className="snippet">
          <span className="dollar">$</span>
          <span className="cmd">{t('hero.snippet.command')}</span>
        </span>

        <div className="hero-ctas">
          <a href="/register" style={{ textDecoration: 'none' }}>
            <button type="button">{t('hero.cta.primary')}</button>
          </a>
          <a href="/login" style={{ textDecoration: 'none' }}>
            <button type="button" className="secondary">
              {t('hero.cta.secondary')}
            </button>
          </a>
        </div>
      </section>

      {/* ── Automate-your-work split (terminal + text) ───────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 'var(--space-xl)',
          alignItems: 'center',
          padding: 'var(--space-section) 0 0',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <h3>{t('block.automate.title')}</h3>
          <p>{t('block.automate.body')}</p>
        </div>
        <div className="terminal">
          <div className="terminal-bar">
            <span className="traffic red" />
            <span className="traffic yellow" />
            <span className="traffic green" />
          </div>
          <div className="terminal-body">
            <div>
              <span className="prompt">$</span>openhunter verify shop.example.com
            </div>
            <div className="out">→ DNS TXT verified · scope = shop.example.com</div>
            <div>
              <span className="prompt">$</span>openhunter scan --pkg light
            </div>
            <div className="out">
              → browser_inspect · zap_passive · nuclei_safe · openhack · strix
            </div>
            <div className="comment"># findings (sanitized) → finding board → retest</div>
          </div>
        </div>
      </section>

      {/* ── Packages (5-up) ──────────────────────────────────── */}
      <section style={{ padding: 'var(--space-section) 0 0' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
            textAlign: 'center',
            alignItems: 'center',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <h2>{t('block.packages.title')}</h2>
          <p style={{ maxWidth: 560 }}>{t('block.packages.body')}</p>
        </div>
        <div className="grid-5">
          <PkgCard tier="free" t={t} />
          <PkgCard tier="light" t={t} />
          <PkgCard tier="standard" t={t} />
          <PkgCard tier="auth" t={t} />
          <PkgCard tier="launch" t={t} dark />
        </div>
      </section>

      {/* ── Data privacy ─────────────────────────────────────── */}
      <section style={{ padding: 'var(--space-section) 0 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            gap: 'var(--space-xl)',
            alignItems: 'flex-start',
            maxWidth: 640,
            margin: '0 auto',
          }}
        >
          <LockIcon />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <h3>{t('block.privacy.title')}</h3>
            <p>{t('block.privacy.body')}</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section
        style={{
          padding: 'var(--space-section) 0 var(--space-xxl)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-lg)',
        }}
      >
        <h2 style={{ maxWidth: 520 }}>{t('block.final.title')}</h2>
        <p style={{ maxWidth: 520 }}>{t('block.final.body')}</p>
        <a href="/register" style={{ textDecoration: 'none' }}>
          <button type="button">{t('block.final.cta')}</button>
        </a>
      </section>
    </>
  );
}

type PkgTier = 'free' | 'light' | 'standard' | 'auth' | 'launch';

function PkgCard({
  tier,
  t,
  dark = false,
}: {
  tier: PkgTier;
  t: ReturnType<typeof useT>;
  dark?: boolean;
}) {
  const title = t(`pkg.${tier}.title` as MessageKey);
  const tag = t(`pkg.${tier}.tag` as MessageKey);
  const use = t(`pkg.${tier}.use` as MessageKey);
  return (
    <div className={`card ${dark ? 'dark' : ''}`} style={{ padding: 'var(--space-xl)' }}>
      <span className={dark ? 'badge badge-dark' : 'badge'}>{title}</span>
      <h4 style={{ marginBottom: 0, color: dark ? 'var(--on-dark)' : 'var(--ink)' }}>{tag}</h4>
      <p style={{ color: dark ? 'var(--on-dark-mute)' : 'var(--body)' }}>{use}</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
