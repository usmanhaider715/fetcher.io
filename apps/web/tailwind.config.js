/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0b0b10',
        card: '#14141c',
        accent: '#8b5cf6',
        muted: '#a1a1aa',
      },
    },
  },
  plugins: [],
};
