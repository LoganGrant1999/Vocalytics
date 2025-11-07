interface PlanBadgeProps {
  plan: "free" | "pro";
}

const PlanBadge = ({ plan }: PlanBadgeProps) => {
  if (plan === "pro") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary glow-accent">
        Pro
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      Free
    </div>
  );
};

export default PlanBadge;
