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
        // Paleta oficial de MUURKET — RWA Ganadero & Agrofintech
        monte: {
          DEFAULT: '#173F32',
          light: '#235A48',
          dark: '#0F2C23',
          surface: '#F0F5F2',
        },
        profundo: {
          DEFAULT: '#102C24',
          dark: '#0a1d17',
          surface: '#14352b',
        },
        esmeralda: {
          DEFAULT: '#059669',
          light: '#00D9A0',
          hover: '#047857',
          subtle: 'rgba(5, 150, 105, 0.12)',
          badge: '#E6F7F0',
        },
        crema: {
          DEFAULT: '#F5F1E7',
          canvas: '#F8F5EE',
          soft: '#FAF7F2',
          surface: '#F3EFE6',
          card: '#FFFFFF',
          border: '#E5DFD3',
          dark: '#E6DFD1',
        },
        blanco: {
          DEFAULT: '#FFFFFF',
          ivory: '#FFFEFA',
          muted: '#E8ECE7',
        },
        cuero: {
          DEFAULT: '#C77B43',
          hover: '#A85D26',
          dark: '#8C4B1E',
          light: '#FBF2E9',
          subtle: 'rgba(199, 123, 67, 0.12)',
          border: '#EACBBA',
        },
        salvia: {
          DEFAULT: '#365B4C',
          light: '#EAF1E9',
          border: '#CBDCCC',
        },
        arena: {
          DEFAULT: '#B88B32',
          light: '#F8F3E6',
          border: '#E8DEC4',
        },
        verdeSuave: {
          DEFAULT: '#DCE7D8',
          subtle: 'rgba(220, 231, 216, 0.25)',
          border: '#D0DEC9',
        },
        tinta: {
          DEFAULT: '#18231E',
          light: '#3F4E46',
          muted: '#6B7B72',
          subtle: '#94A39B',
        },
        grafito: {
          DEFAULT: '#292D29',
          card: '#1e2421',
        },
        piedra: {
          DEFAULT: '#6B7B72',
          light: '#8E9C94',
          dark: '#47544D',
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
