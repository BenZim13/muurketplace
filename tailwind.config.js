/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta oficial de MUURKET — RWA Ganadero
        monte: {
          DEFAULT: '#173F32',
          light: '#1f5242',
          dark: '#13352a',
        },
        profundo: {
          DEFAULT: '#102C24',
          dark: '#0a1d17',
          surface: '#14352b',
        },
        esmeralda: {
          DEFAULT: '#00D9A0',
          hover: '#00c28e',
          subtle: 'rgba(0, 217, 160, 0.12)',
        },
        crema: {
          DEFAULT: '#F5F1E7',
          soft: '#faf7f2',
          dark: '#ebe4d5',
        },
        blanco: {
          DEFAULT: '#FFFEFA',
          muted: '#e8ece7',
        },
        cuero: {
          DEFAULT: '#C77B43',
          hover: '#b56d38',
          subtle: 'rgba(199, 123, 67, 0.15)',
        },
        verdeSuave: {
          DEFAULT: '#DCE7D8',
          subtle: 'rgba(220, 231, 216, 0.1)',
        },
        grafito: {
          DEFAULT: '#292D29',
          card: '#1e2421',
        },
        piedra: {
          DEFAULT: '#A5ADA5',
          light: '#c2cac2',
          dark: '#7c847c',
        },
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'subtle': '8px',
        'pill': '9999px',
      },
      boxShadow: {
        'smoked': '0 8px 32px 0 rgba(10, 29, 23, 0.45)',
        'elevated': '0 12px 40px -10px rgba(0, 0, 0, 0.65)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
