/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#0D1117',
          900: '#12161F',
          800: '#181D29',
          700: '#232A3B',
          600: '#333C52',
          500: '#4B5570',
        },
        amber: {
          400: '#F5B942',
          500: '#EFA623',
          600: '#D48A0F',
        },
        mist: {
          100: '#F4F6FA',
          300: '#C7CEDB',
          500: '#8B93A7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
