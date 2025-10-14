interface SentimentBarProps {
  sentiments: {
    positive: number;
    neutral: number;
    negative: number;
  };
  totalComments: number;
}

/**
 * Displays a horizontal sentiment distribution bar with percentages.
 */
export function SentimentBar({ sentiments, totalComments }: SentimentBarProps) {
  const positivePercent = totalComments > 0 ? (sentiments.positive / totalComments) * 100 : 0;
  const neutralPercent = totalComments > 0 ? (sentiments.neutral / totalComments) * 100 : 0;
  const negativePercent = totalComments > 0 ? (sentiments.negative / totalComments) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="font-medium">Positive</span>
          <span className="text-muted-foreground">{sentiments.positive}</span>
        </div>
        <span className="font-semibold">{positivePercent.toFixed(1)}%</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
          <span className="font-medium">Neutral</span>
          <span className="text-muted-foreground">{sentiments.neutral}</span>
        </div>
        <span className="font-semibold">{neutralPercent.toFixed(1)}%</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="font-medium">Negative</span>
          <span className="text-muted-foreground">{sentiments.negative}</span>
        </div>
        <span className="font-semibold">{negativePercent.toFixed(1)}%</span>
      </div>

      {/* Visual bar */}
      <div className="flex h-2 rounded-full overflow-hidden">
        {positivePercent > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${positivePercent}%` }}
          ></div>
        )}
        {neutralPercent > 0 && (
          <div
            className="bg-gray-400"
            style={{ width: `${neutralPercent}%` }}
          ></div>
        )}
        {negativePercent > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${negativePercent}%` }}
          ></div>
        )}
      </div>
    </div>
  );
}
