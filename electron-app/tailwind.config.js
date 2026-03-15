/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        harbour: {
          bg: '#f2f4f7',
          surface: '#fbfcfd',
          panel: '#f7f9fc',
          border: '#d5dde8',
          text: '#111827',
          muted: '#5f6b7a',
          accent: '#0f766e',
          accentSoft: '#d7f3ef',
          caution: '#b45309',
          danger: '#b42318',
          success: '#166534',
        },
      },
    },
  },
  plugins: [],
};
