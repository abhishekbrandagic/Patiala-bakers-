/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Black and white theme
        cream: { DEFAULT: '#FFFFFF', 2: '#F2F2F2', 3: '#EBEBEB' },
        paper: '#FFFFFF',
        line: { DEFAULT: '#D4D4D4', 2: '#E5E5E5' },
        ink: { DEFAULT: '#111111', 2: '#404040' },
        mute: '#6B6B6B',
        wine: { DEFAULT: '#111111', 2: '#000000', d: '#000000', ink: '#0A0A0A' },
        gold: { DEFAULT: '#111111', d: '#555555', l: '#E5E5E5', bg: '#F2F2F2' },
        ok: { DEFAULT: '#2B6638', bg: '#E4EFE1' },
        warn: { DEFAULT: '#8A5506', bg: '#FAEDD2' },
        bad: { DEFAULT: '#A12428', bg: '#F8E0DD' },
        info: { DEFAULT: '#2B5A88', bg: '#E2EBF5' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        1: '0 1px 2px rgba(0,0,0,.06),0 2px 10px rgba(0,0,0,.05)',
        2: '0 12px 32px rgba(0,0,0,.10),0 2px 6px rgba(0,0,0,.06)',
        3: '0 30px 80px rgba(0,0,0,.28)',
      },
    },
  },
  plugins: [],
};