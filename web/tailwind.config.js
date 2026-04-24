/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#f4e8d4',
        storm: '#0f1419',
        aegean: '#1a3a4a',
        styx: '#0d1f14',
        gold: '#c9a227',
        ichor: '#7c3aed',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
