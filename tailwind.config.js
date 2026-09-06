/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#edf7fc', 100: '#d6eaf5', 200: '#aed4e9', 300: '#81bddc', 400: '#55a7cf', 500: '#318bb8', 600: '#247ca6', 700: '#1b668c', 800: '#1b536f', 900: '#1a455d', 950: '#102f43' },
        blush: { 50: '#fff8fb', 100: '#f9e5ee', 200: '#f1d2e0' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
