/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff7ff',
          100: '#dceeff',
          200: '#bddfff',
          300: '#8bc8ff',
          400: '#51a7fb',
          500: '#2288f4',
          600: '#076bed',
          700: '#0756c5',
          800: '#0b479c',
          900: '#103e7c',
          950: '#0a264e',
        },
        slate: {
          850: '#151e2e',
          950: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
