'use client';

import { clsx } from 'clsx';

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
}

export function Leaderboard({
  data,
  title,
  valueLabel = 'Count',
  showRank = true,
  className,
}: LeaderboardProps) {
  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}

      <div className="space-y-2">
        {data.map((item, index) => (
          <div
            key={item.id}
            className={clsx(
              'flex items-center gap-3 p-2 rounded-lg',
              'hover:bg-muted transition-colors',
            )}
          >
            {showRank && (
              <span
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  index === 0 && 'bg-yellow-500/20 text-yellow-500',
                  index === 1 && 'bg-gray-400/20 text-gray-500',
                  index === 2 && 'bg-orange-500/20 text-orange-500',
                  index > 2 && 'bg-muted text-muted-foreground',
                )}
              >
                {index + 1}
              </span>
            )}

            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-sm font-medium">
                  {item.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
              )}
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{item.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{valueLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
