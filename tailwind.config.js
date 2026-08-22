/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Earth / agriculture inspired palette. All pairings below are checked for WCAG AA.
        brand: {
          50: '#f2f9f1',
          100: '#e0f1de',
          200: '#c1e3bf',
          300: '#93cd90',
          400: '#5fb05d',
          500: '#3d9440',
          600: '#2b7632',
          700: '#245e2b',
          800: '#1f4b25',
          900: '#1a3e21',
        },
        soil: {
          50: '#faf7f2',
          100: '#f0e9dd',
          200: '#ded0ba',
          600: '#8a6a43',
          700: '#6d5335',
        },
        // Warm harvest accent used for highlights and CTAs.
        harvest: {
          50: '#fff8eb',
          100: '#feefc7',
          200: '#fddf8a',
          300: '#fbc94d',
          400: '#f9b224',
          500: '#f39c0c',
          600: '#d77c07',
          700: '#b25b0a',
          800: '#90470f',
          900: '#763a10',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'Noto Sans Gujarati', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // Farmer-friendly defaults: nothing smaller than 14px anywhere in the UI.
        xs: ['0.875rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 40, 24, 0.04), 0 8px 24px -12px rgba(16, 40, 24, 0.18)',
        card: '0 1px 3px rgba(16, 40, 24, 0.06), 0 12px 32px -16px rgba(16, 40, 24, 0.22)',
        lift: '0 10px 40px -12px rgba(16, 40, 24, 0.30)',
        glow: '0 0 0 4px rgba(61, 148, 64, 0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2b7632 0%, #245e2b 100%)',
        'brand-sheen': 'linear-gradient(135deg, #3d9440 0%, #1f4b25 100%)',
        'field-radial':
          'radial-gradient(1200px 600px at 10% -10%, rgba(147,205,144,0.35), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(251,201,77,0.25), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
};
