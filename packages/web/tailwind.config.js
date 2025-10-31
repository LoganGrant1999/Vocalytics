/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn/UI compatibility (HSL)
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
        // Vocalytics Brand Colors (RGB)
        'brand-primary': 'var(--color-primary)',
        'brand-primary-hover': 'var(--color-primary-hover)',
        'brand-primary-light': 'var(--color-primary-light)',
        'brand-secondary': 'var(--color-secondary)',
        'brand-secondary-light': 'var(--color-secondary-light)',
        'brand-secondary-muted': 'var(--color-secondary-muted)',
        'brand-bg': 'var(--color-bg)',
        'brand-bg-alt': 'var(--color-bg-alt)',
        'brand-surface': 'var(--color-surface)',
        'brand-border': 'var(--color-border)',
        'brand-text-primary': 'var(--color-text-primary)',
        'brand-text-secondary': 'var(--color-text-secondary)',
        'brand-text-inverse': 'var(--color-text-inverse)',
        'brand-text-accent': 'var(--color-text-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        // Utility aliases for direct use
        'primary-hover': 'var(--color-primary-hover)',
        'primary-light': 'var(--color-primary-light)',
        'surface': 'var(--color-surface)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-inverse': 'var(--color-text-inverse)',
      },
      backgroundColor: theme => ({
        ...theme('colors'),
        'brand-secondary-ghost': 'var(--color-secondary-ghost)',
      }),
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '12px',
      },
      boxShadow: {
        'brand-card': 'var(--color-shadow)',
        'card': 'var(--color-shadow)',
      },
      backgroundImage: {
        'gradient-brand-primary': 'var(--gradient-primary)',
        'gradient-sentiment': 'var(--gradient-sentiment)',
        'gradient-brand-bg': 'var(--gradient-bg)',
      },
    },
  },
  plugins: [],
};
