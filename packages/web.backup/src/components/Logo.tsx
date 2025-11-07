export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/images/Vocalytics.png" alt="Vocalytics" style={{ height: 32 }} />
    </div>
  );
}
