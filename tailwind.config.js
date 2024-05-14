/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        PermanentMarker: ['"Permanent Marker"', 'cursive'],
        Roboto: ['"Roboto"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
