import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50:  'oklch(98.5% .002 247.839)',
          100: 'oklch(96.7% .003 264.542)',
          200: 'oklch(92.8% .006 264.531)',
          300: 'oklch(87.2% .01 258.338)',
          400: 'oklch(70.7% .022 261.325)',
          500: 'oklch(55.1% .027 264.364)',
          600: 'oklch(44.6% .03 256.802)',
          700: 'oklch(37.3% .034 259.733)',
          800: 'oklch(27.8% .033 256.848)',
          900: 'oklch(21% .034 264.665)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
