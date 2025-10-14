import { cn } from '@/lib/utils';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  period: string;
  className?: string;
}

/**
 * Visual meter showing usage vs limit for a resource.
 * Used for tracking weekly comment analyses and daily reply generations.
 */
export function UsageMeter({
  label,
  used,
  limit,
  period,
  className,
}: UsageMeterProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            'text-muted-foreground',
            isAtLimit && 'text-destructive font-semibold',
            isNearLimit && !isAtLimit && 'text-yellow-600 font-semibold'
          )}
        >
          {used} / {limit} {period}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            isAtLimit && 'bg-destructive',
            isNearLimit && !isAtLimit && 'bg-yellow-500',
            !isNearLimit && 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isAtLimit && (
        <p className="text-xs text-destructive">
          Limit reached. Upgrade to continue.
        </p>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-yellow-600">
          Approaching limit. Consider upgrading.
        </p>
      )}
    </div>
  );
}
