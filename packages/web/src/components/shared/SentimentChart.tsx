import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SentimentChartProps {
  positive: number;
  neutral: number;
  negative: number;
}

const SentimentChart = ({ positive, neutral, negative }: SentimentChartProps) => {
  const total = positive + neutral + negative;

  // Filter out zero values to render a cleaner pie chart
  const data = [
    { name: "Positive", value: positive, color: "hsl(var(--success))" },
    { name: "Neutral", value: neutral, color: "hsl(var(--warning))" },
    { name: "Negative", value: negative, color: "hsl(var(--destructive))" },
  ].filter(entry => entry.value > 0);

  console.log('[SentimentChart] Data:', { positive, neutral, negative, data, total });

  const renderLabel = (entry: any) => {
    const percent = ((entry.value / total) * 100).toFixed(0);
    return `${entry.name} (${percent}%)`;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value} comments`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default SentimentChart;
