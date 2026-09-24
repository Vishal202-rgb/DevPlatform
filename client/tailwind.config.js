/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Linear / Vercel inspired dark obsidian scale
        graphite: {
          950: '#090B10', // page background
          900: '#10131C', // card/panel background
          850: '#161A26', // elevated modal / popover
          800: '#1D2232', // input background / secondary surface
          700: '#2A3249', // subtle borders
          600: '#3C4665', // stronger borders / focus baseline
          500: '#5F6D8F', // muted icons / tertiary text
        },
        // Premium amber accent for buttons, badges, highlights
        amber: {
          300: '#FCD34D',
          400: '#F59E0B', // primary accent
          500: '#D97706', // hover accent
          600: '#B45309', // active
        },
        // Crisp high-contrast text scale
        mist: {
          100: '#F8FAFC', // primary heading / strong text
          200: '#E2E8F0', // secondary headings / inputs
          300: '#CBD5E1', // body copy
          400: '#94A3B8', // supporting descriptions
          500: '#64748B', // muted metadata & hints
          600: '#475569', // placeholder text
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 12px 28px -12px rgba(0, 0, 0, 0.6)',
        'panel-hover': '0 4px 20px -2px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(245, 158, 11, 0.15)',
        glow: '0 0 25px -5px rgba(245, 158, 11, 0.25)',
        'glow-sm': '0 0 12px -2px rgba(245, 158, 11, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};