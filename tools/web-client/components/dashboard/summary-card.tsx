import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SummaryCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  variant?: "default" | "critical" | "warning" | "info"
}

const variantStyles = {
  default: "border-l-4 border-l-primary",
  critical: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-yellow-500",
  info: "border-l-4 border-l-blue-500",
}

const iconColors = {
  default: "text-primary",
  critical: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
}

export function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-card p-6 shadow-sm transition-all hover:shadow-md",
        variantStyles[variant]
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Icon className={cn("h-8 w-8", iconColors[variant])} />
      </div>
    </div>
  )
}