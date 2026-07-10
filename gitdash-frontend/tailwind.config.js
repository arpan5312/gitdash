/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#08090B',
          900: '#0D0F12',
          800: '#131519',
          700: '#1B1E24',
          600: '#262A31',
          500: '#363B44'
        },
        ink: {
          100: '#EDEEF0',
          300: '#B7BBC2',
          500: '#8B909A',
          700: '#5B606A'
        },
        signal: {
          blue: '#5B8DEF',
          red: '#D9564F',
          green: '#4FAE7E',
          orange: '#D98A3D',
          purple: '#8E6FD9'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        glow: '0 0 24px 2px var(--tw-shadow-color)'
      },
      keyframes: {
        pulseSlow: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' }
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      },
      animation: {
        'pulse-slow': 'pulseSlow 2.4s ease-in-out infinite',
        scan: 'scan 3s linear infinite'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
