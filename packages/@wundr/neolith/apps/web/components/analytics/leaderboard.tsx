'use client';

import { clsx } from 'clsx';
import Image from 'next/image';

/**
 * Props for the Leaderboard component.
 */
export interface LeaderboardProps {
  /** Array of leaderboard entries to display */
  data: Array<{
    /** Unique identifier for the entry */
    id: string;
    /** Display name of the entry */
    name: string;
    /** Numeric value used for ranking */
    value: number;
    /** Optional avatar image URL */
    avatarUrl?: string;
    /** Optional subtitle text */
    subtitle?: string;
  }>;
  /** Optional title displayed above the leaderboard */
  title?: string;
  /** Label for the value column */
  valueLabel?: string;
  /** Whether to show rank numbers */
  showRank?: boolean;
  /** Additional CSS classes to apply */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

export function Leaderboard({
  data,
  title,
  valueLabel = 'Count',
  showRank = true,
  className,
  isLoading = false,
}: LeaderboardProps) {
  if (isLoading) {
    return (
      <div className={className}>
        {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={className}>
        {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}

      <div className="space-y-2">
        {data.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className={clsx(
              'flex items-center gap-3 p-2 rounded-lg',
              'hover:bg-muted transition-colors cursor-default',
            )}
          >
            {showRank && (
              <span
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0',
                  index === 0 && 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
                  index === 1 && 'bg-stone-400/20 text-stone-600 dark:text-stone-400',
                  index === 2 && 'bg-orange-600/20 text-orange-700 dark:text-orange-400',
                  index > 2 && 'bg-muted text-muted-foreground',
                )}
                title={`Rank ${index + 1}`}
              >
                {index + 1}
              </span>
            )}

            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {item.avatarUrl ? (
                <Image
                  src={item.avatarUrl}
                  alt={`${item.name} avatar`}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : null}
              {!item.avatarUrl && (
                <span className="text-primary text-sm font-medium">
                  {item.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate" title={item.name}>
                {item.name}
              </p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate" title={item.subtitle}>
                  {item.subtitle}
                </p>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium text-foreground">{item.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{valueLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
