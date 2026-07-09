/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#07080B',
          900: '#0A0C10',
          800: '#12151B',
          700: '#1B1F27',
          600: '#242934',
          border: '#1F242D'
        },
        ink: {
          100: '#E7EAF0',
          300: '#AAB2C2',
          500: '#8890A0',
          700: '#5A6274'
        },
        accent: {
          DEFAULT: '#38D9C4',
          dim: '#1F7A70',
          glow: '#5FF3E0'
        },
        risk: {
          low: '#3ECF8E',
          mid: '#F2C94A',
          high: '#F2994A',
          critical: '#E0524C'
        },
        node: {
          source: '#DC4545',
          docs: '#4C8DFF',
          test: '#3ECF8E',
          infra: '#F2994A',
          pipeline: '#9B6BFF'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif']
      },
      keyframes: {
        'scan-drift': {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(4%)' }
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.25 }
        }
      },
      animation: {
        'scan-drift': 'scan-drift 18s ease-in-out infinite alternate',
        blink: 'blink 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
