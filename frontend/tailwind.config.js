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
    },
  },
  plugins: [],
};
