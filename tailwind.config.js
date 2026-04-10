/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#58CC02',
          dark:    '#46A302',
          light:   '#89E219',
          muted:   '#D7F5B1',
        },
        accent: {
          purple: '#CE82FF',
          blue:   '#1CB0F6',
          orange: '#FF9600',
          red:    '#FF4B4B',
          pink:   '#FF86D0',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          card:    '#F7F7F7',
          border:  '#E5E5E5',
        },
        ink: {
          DEFAULT: '#1F1F1F',
          muted:   '#6B7280',
          light:   '#9CA3AF',
        },
        streak: '#FF9600',
        xp:     '#58CC02',
      },
      fontFamily: {
        sans:    ['Nunito', 'ui-sans-serif', 'system-ui'],
        display: ['Nunito', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        'xl':  '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        'pill': '9999px',
      },
      boxShadow: {
        'card':   '0 2px 12px rgba(0,0,0,0.08)',
        'card-lg':'0 4px 24px rgba(0,0,0,0.12)',
        'btn':    '0 4px 0 rgba(0,0,0,0.15)',
        'btn-active': '0 1px 0 rgba(0,0,0,0.15)',
        'glow-green': '0 0 20px rgba(88,204,2,0.35)',
        'glow-blue':  '0 0 20px rgba(28,176,246,0.35)',
      },
      keyframes: {
        'bounce-in': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(88,204,2,0.4)' },
          '70%':  { boxShadow: '0 0 0 12px rgba(88,204,2,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(88,204,2,0)' },
        },
        'check-pop': {
          '0%':   { transform: 'scale(0)' },
          '50%':  { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'bounce-in':  'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'slide-up':   'slide-up 0.35s ease-out forwards',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'check-pop':  'check-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'shimmer':    'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
