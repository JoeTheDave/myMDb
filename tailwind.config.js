/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/client/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    extend: {
      fontFamily: {
        PermanentMarker: ['"Permanent Marker"', 'cursive'],
        Roboto: ['"Roboto"', 'sans-serif'],
        Kalam: ['"Kalam"', 'cursive'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['emerald', 'corporate', 'fantasy', 'nord', 'winter'],
  },
}
