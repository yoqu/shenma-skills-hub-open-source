import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '"Noto Sans SC"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Primary brand — indigo. Values mirror data.jsx TOKENS (the JS variant
        // the prototype actually renders with).
        brand: {
          DEFAULT: '#4F46E5',
          soft: '#EEF2FF',
          deep: '#3730A3',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        ink: {
          1: '#0F172A',
          2: '#475569',
          3: '#94A3B8',
        },
        line: {
          DEFAULT: '#E2E8F0',
          soft: '#EEF0F4',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F8FAFC',
          gray: '#F1F5F9',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#0EA5E9',
        },
        // shadcn-style semantic aliases (so a shadcn install can drop in cleanly)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,17,22,.04), 0 1px 1px rgba(15,17,22,.03)',
        md: '0 4px 16px rgba(15,17,22,.06), 0 1px 2px rgba(15,17,22,.04)',
        lg: '0 12px 36px rgba(15,17,22,.08), 0 2px 6px rgba(15,17,22,.04)',
        ring: '0 0 0 3px rgba(79,70,229,.18)',
      },
    },
  },
  plugins: [],
};

export default config;
