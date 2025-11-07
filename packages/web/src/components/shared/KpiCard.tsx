interface KpiCardProps {
  label: string;
  value: string;
  sublabel: string;
  tone?: "default" | "warning" | "success";
}

const KpiCard = ({ label, value, sublabel, tone = "default" }: KpiCardProps) => {
  const borderClass = tone === "warning" ? "glow-border" : "border border-border";
  
  return (
    <div className={`rounded-2xl bg-card p-6 ${borderClass} hover:border-primary/30 transition-all duration-300`}>
      <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
    </div>
  );
};

export default KpiCard;
