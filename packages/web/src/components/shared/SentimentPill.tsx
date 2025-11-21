interface SentimentPillProps {
  sentiment: "Positive" | "Mixed" | "Neutral" | "Negative";
  score?: number;
}

const SentimentPill = ({ sentiment, score }: SentimentPillProps) => {
  const getColorClasses = () => {
    switch (sentiment) {
      case "Positive":
        return "bg-success/10 text-success";
      case "Mixed":
      case "Neutral":
        return "bg-warning/10 text-warning";
      case "Negative":
        return "bg-destructive/10 text-destructive";
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getColorClasses()}`}>
      {sentiment} {score !== undefined && `(${Math.round(score * 100)}%)`}
    </div>
  );
};

export default SentimentPill;
