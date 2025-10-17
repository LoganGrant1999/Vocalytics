import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem('vocalytics-theme');
    if (stored) {
      return stored === 'dark';
    }
    // Otherwise check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('vocalytics-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('vocalytics-theme', 'light');
    }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return { isDark, toggle };
}
