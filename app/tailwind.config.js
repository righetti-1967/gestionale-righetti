/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        apple: {
          blue: '#007AFF',
          gray: '#8E8E93',
          lightgray: '#F2F2F7',
          darkgray: '#1C1C1E',
        },
      },
      borderRadius: {
        'apple': '12px',
      },
      boxShadow: {
        'apple': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'apple-lg': '0 10px 40px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
