interface SentimentBarProps {
  sentiments: {
    positive: number;
    neutral: number;
    negative: number;
  };
  totalComments: number;
}

/**
 * Displays a pie chart showing sentiment distribution with percentages.
 */
export function SentimentBar({ sentiments, totalComments }: SentimentBarProps) {
  const positivePercent = totalComments > 0 ? (sentiments.positive / totalComments) * 100 : 0;
  const neutralPercent = totalComments > 0 ? (sentiments.neutral / totalComments) * 100 : 0;
  const negativePercent = totalComments > 0 ? (sentiments.negative / totalComments) * 100 : 0;

  // Calculate pie chart angles
  const total = positivePercent + neutralPercent + negativePercent;
  const positiveAngle = (positivePercent / total) * 360;
  const neutralAngle = (neutralPercent / total) * 360;
  const negativeAngle = (negativePercent / total) * 360;

  // Create conic gradient for pie chart
  const gradientStops = [];
  let currentAngle = 0;

  if (positivePercent > 0) {
    gradientStops.push(`#22c55e ${currentAngle}deg ${currentAngle + positiveAngle}deg`);
    currentAngle += positiveAngle;
  }
  if (neutralPercent > 0) {
    gradientStops.push(`#9ca3af ${currentAngle}deg ${currentAngle + neutralAngle}deg`);
    currentAngle += neutralAngle;
  }
  if (negativePercent > 0) {
    gradientStops.push(`#ef4444 ${currentAngle}deg ${currentAngle + negativeAngle}deg`);
  }

  return (
    <div className="flex gap-6 items-center">
      {/* Pie chart */}
      <div
        className="w-32 h-32 rounded-full flex-shrink-0"
        style={{
          background: `conic-gradient(${gradientStops.join(', ')})`,
        }}
      />

      {/* Legend */}
      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="font-medium">Positive</span>
          </div>
          <span className="font-semibold">{positivePercent.toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="font-medium">Neutral</span>
          </div>
          <span className="font-semibold">{neutralPercent.toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="font-medium">Negative</span>
          </div>
          <span className="font-semibold">{negativePercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
