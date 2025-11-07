/**
 * Centralized chart theme configuration for Vocalytics
 * Uses CSS custom properties for dynamic theming
 */

const getThemeColor = (property: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim() || fallback;
};

export const chartTheme = {
  // Neutral colors for axes and grids
  axisColor: getThemeColor('--color-secondary-muted', '#6B7280'),
  gridColor: 'rgba(107, 114, 128, 0.2)',

  // Sentiment colors
  positive: '#10B981',
  neutral: '#F59E0B',
  negative: '#EF4444',

  // Chart backgrounds
  backgroundColor: getThemeColor('--color-surface', '#FFFFFF'),

  // Text colors
  labelColor: getThemeColor('--color-text-secondary', '#6B7280'),
  titleColor: getThemeColor('--color-text-primary', '#111827'),
};

/**
 * Returns recharts-compatible axis style object
 */
export const getAxisStyle = () => ({
  stroke: chartTheme.axisColor,
  fontSize: 12,
  fontFamily: 'inherit',
});

/**
 * Returns recharts-compatible grid style object
 */
export const getGridStyle = () => ({
  stroke: chartTheme.gridColor,
  strokeDasharray: '3 3',
});

/**
 * Returns recharts-compatible legend style object
 */
export const getLegendStyle = () => ({
  fontSize: 12,
  fontFamily: 'inherit',
  color: chartTheme.labelColor,
});
