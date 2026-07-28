/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sainte-blue': '#1e3a8a',
        'sainte-gold': '#d4a24c',
      }
    },
  },
  plugins: [],
}