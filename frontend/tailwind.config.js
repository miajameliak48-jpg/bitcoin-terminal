/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        panel: '#161b22',
        border: '#30363d',
        buy: '#3fb950',
        sell: '#f85149',
        ema: '#ff9500',
        accent: '#1f6feb',
        text: '#e6edf3',
        muted: '#8b949e',
      },
      boxShadow: {
        'glow-accent': '0 0 28px rgba(31, 111, 235, 0.18), 0 0 10px rgba(31, 111, 235, 0.10)',
        'glow-buy':    '0 0 28px rgba(63, 185, 80, 0.15),  0 0 10px rgba(63, 185, 80, 0.08)',
        'glow-ema':    '0 0 28px rgba(255, 149, 0, 0.14),  0 0 10px rgba(255, 149, 0, 0.07)',
      },
      keyframes: {
        slideFromRight: {
          from: { opacity: '0', transform: 'translateX(18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideFromLeft: {
          from: { opacity: '0', transform: 'translateX(-18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-from-right': 'slideFromRight 0.22s cubic-bezier(0.4, 0, 0.2, 1) both',
        'slide-from-left':  'slideFromLeft  0.22s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
