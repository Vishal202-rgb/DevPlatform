/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // DevMind Dark Obsidian Design System
        graphite: {
          950: '#080B12', // Background: #080B12
          900: '#11151D', // Cards/Surface: #11151D
          850: '#181D27', // Hover Surface: #181D27
          800: '#141923', // Inset / Sub-surface: #141923
          750: '#252B36', // Borders: #252B36
          700: '#252B36', // Borders: #252B36
          600: '#353D4D', // Active / Focused borders
          500: '#667085', // Muted Text: #667085
        },
        // Text scale
        mist: {
          100: '#F5F7FA', // Primary Text: #F5F7FA
          200: '#E4E7EC', // Secondary Headings
          300: '#C8D1DE', // Secondary Text light
          400: '#9AA3B2', // Secondary Text: #9AA3B2
          500: '#667085', // Muted Text: #667085
          600: '#475467', // Subdued placeholders
        },
        // Primary Brand Accent: Premium Warm Amber
        amber: {
          300: '#E0A11A', // Primary Hover: #E0A11A
          400: '#D89A16', // Primary Brand Accent: #D89A16
          500: '#C2870F', // Active / Pressed: #C2870F
          600: '#A36F0A',
        },
        // Semantic System
        emerald: {
          300: '#86EFAC',
          400: '#22C55E', // Success: #22C55E
          500: '#16A34A',
        },
        rose: {
          300: '#FCA5A5',
          400: '#EF4444', // Error: #EF4444
          500: '#DC2626',
        },
        orange: {
          300: '#FDBA74',
          400: '#F97316',
          500: '#EA580C',
        },
        sky: {
          300: '#93C5FD',
          400: '#60A5FA', // Info: #60A5FA
          500: '#3B82F6',
        },
        purple: {
          300: '#D8B4FE',
          400: '#A855F7', // AI/Purple: #A855F7
          500: '#9333EA',
          600: '#7E22CE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 6px 16px -4px rgba(0, 0, 0, 0.5)',
        'panel-hover': '0 2px 6px 0 rgba(0, 0, 0, 0.5), 0 10px 24px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(245, 158, 11, 0.15)',
        glow: '0 0 20px -4px rgba(245, 158, 11, 0.2)',
        'glow-sm': '0 0 10px -2px rgba(245, 158, 11, 0.15)',
        'glow-purple': '0 0 12px -2px rgba(168, 85, 247, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.8s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
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