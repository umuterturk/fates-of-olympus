/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Greek mythology theme
        olympus: {
          gold: '#D4AF37',
          marble: '#F5F5F5',
          bronze: '#CD7F32',
          navy: '#1B2838',
          sky: '#87CEEB',
        },
        card: {
          bg: '#2A2A2A',
          border: '#4A4A4A',
          power: '#FFD700',
          cost: '#4FC3F7',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-power': 'pulse-power 0.5s ease-in-out',
        'card-reveal': 'card-reveal 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-power': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'card-reveal': {
          '0%': { transform: 'rotateY(180deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
