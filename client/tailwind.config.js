/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { lime: { 400: '#a3e635', 500: '#84cc16', 600: '#65a30d' } } } },
  plugins: [],
}
