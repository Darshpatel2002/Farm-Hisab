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
      },
      fontSize: {
        // Farmer-friendly defaults: nothing smaller than 14px anywhere in the UI.
        xs: ['0.875rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
      },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
};
