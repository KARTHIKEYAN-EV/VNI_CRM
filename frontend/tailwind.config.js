/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',  // Enables dark: prefix; light is now base (no .dark class)
  theme: {
    screens: { xs:'480px', sm:'640px', md:'768px', lg:'1024px', xl:'1280px' },
    extend: {
      colors: {
        brand: {
          red:       '#e8202a',
          'red-dark':'#b91c1c',
          navy:      '#1E293D',
          blue:      '#06b6d4',
        },
      },
      fontFamily: {
        sans:    ['Inter',        'system-ui', 'sans-serif'],
        display: ['Space Grokesk','system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
