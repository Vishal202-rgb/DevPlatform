/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light grey/white surface scale (was a dark near-black scale).
        graphite: {
          950: '#FFFFFF', // page background
          900: '#F7F7F8', // card/panel background
          800: '#EFEFF1', // secondary surface / hover / input background
          700: '#E2E2E6', // borders
          600: '#C7C7CE', // stronger borders / input focus baseline
          500: '#8B8B95', // muted icons / secondary borders
        },
        // Monochrome accent (was amber) - near-black, used for buttons,
        // links, and focus rings so the whole UI stays grey/white.
        amber: {
          400: '#27272A', // accent - dark charcoal
          500: '#000000', // accent hover - true black
          600: '#000000',
        },
        // Text scale (was light text for a dark theme, now dark text for a
        // light theme).
        mist: {
          100: '#0B0B0D', // primary text - near-black
          300: '#52525B', // secondary text
          500: '#84848C', // muted / placeholder text
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};