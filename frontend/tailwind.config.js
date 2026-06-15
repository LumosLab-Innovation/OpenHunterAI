/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens map to CSS variables (see styles.css) so the
        // light/dark themes swap without touching component classes.
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          raised: 'hsl(var(--surface-raised) / <alpha-value>)',
        },
        hairline: {
          DEFAULT: 'hsl(var(--hairline) / <alpha-value>)',
          strong: 'hsl(var(--hairline-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
          muted: 'hsl(var(--ink-muted) / <alpha-value>)',
          faint: 'hsl(var(--ink-faint) / <alpha-value>)',
        },
        signal: {
          DEFAULT: 'hsl(var(--signal) / <alpha-value>)',
          ink: 'hsl(var(--signal-ink) / <alpha-value>)',
          dim: 'hsl(var(--signal-dim) / <alpha-value>)',
        },
        // Severity scale ��� deliberately distinct hues, none overlapping the
        // lime signal accent, so severity reads unambiguously.
        critical: 'hsl(var(--critical) / <alpha-value>)',
        high: 'hsl(var(--high) / <alpha-value>)',
        medium: 'hsl(var(--medium) / <alpha-value>)',
        low: 'hsl(var(--low) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
        ring: 'hsl(var(--signal) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Chivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
      },
      boxShadow: {
        panel: '0 1px 0 0 hsl(var(--hairline) / 0.6), 0 12px 32px -16px hsl(0 0% 0% / 0.6)',
        glow: '0 0 0 1px hsl(var(--signal) / 0.4), 0 0 24px -4px hsl(var(--signal) / 0.35)',
      },
      backgroundImage: {
        grid: 'linear-gradient(hsl(var(--hairline) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--hairline) / 0.5) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--signal) / 0.5)' },
          '70%': { boxShadow: '0 0 0 6px hsl(var(--signal) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--signal) / 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scan-sweep': 'scan-sweep 1.8s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
