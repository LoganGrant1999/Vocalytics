import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendPoint {
  date: string;
  avgScore: number;
}

interface TrendsChartProps {
  data: TrendPoint[];
}

/**
 * Format date for X axis (e.g., "Oct 15")
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Custom tooltip for trend points
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-md">
        <p className="text-sm font-medium">{formatDate(data.date)}</p>
        <p className="text-sm text-muted-foreground">
          Score: {data.avgScore.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
}

export function TrendsChart({ data }: TrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No trend data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-brand-text-primary">Sentiment Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: 'var(--color-secondary-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              tick={{ fill: 'var(--color-secondary-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-primary)' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
