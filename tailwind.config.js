/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#37352f',
          light: '#787774',
          lighter: '#9b9a97',
        },
        paper: {
          DEFAULT: '#ffffff',
          soft: '#fbfbfa',
          sidebar: '#f7f7f5',
          hover: '#efefee',
          active: '#e8e8e6',
        },
        line: {
          DEFAULT: 'rgba(55, 53, 47, 0.09)',
          strong: 'rgba(55, 53, 47, 0.16)',
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
