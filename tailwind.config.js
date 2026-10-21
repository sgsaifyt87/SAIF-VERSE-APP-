/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          border: 'rgba(255, 255, 255, 0.18)',
          card: 'rgba(255, 255, 255, 0.08)',
          'card-hover': 'rgba(255, 255, 255, 0.14)',
          modal: 'rgba(15, 23, 42, 0.75)',
        }
      },
      backdropBlur: {
        '2xs': '2px',
        'xs': '4px',
        '3xl': '48px',
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
