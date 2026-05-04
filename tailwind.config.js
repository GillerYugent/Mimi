/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          light: 'rgb(var(--color-ink-light) / <alpha-value>)',
          lighter: 'rgb(var(--color-ink-lighter) / <alpha-value>)',
        },
        paper: {
          DEFAULT: 'rgb(var(--color-paper) / <alpha-value>)',
          soft: 'rgb(var(--color-paper-soft) / <alpha-value>)',
          sidebar: 'rgb(var(--color-paper-sidebar) / <alpha-value>)',
          hover: 'rgb(var(--color-paper-hover) / <alpha-value>)',
          active: 'rgb(var(--color-paper-active) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          '"Apple Color Emoji"',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Lyon-Text"', 'Georgia', 'ui-serif', 'serif'],
        mono: [
          '"SFMono-Regular"',
          'Menlo',
          'Consolas',
          '"PT Mono"',
          '"Liberation Mono"',
          'Courier',
          'monospace',
        ],
      },
      boxShadow: {
        notion: '0 1px 2px rgba(15, 15, 15, 0.05)',
        'notion-lg':
          'rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px',
      },
    },
  },
  plugins: [],
}
