import React from "react"
import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ChartErrorProps {
  error?: Error | string
  onRetry?: () => void
  height?: number
}

export function ChartError({ error, onRetry, height = 300 }: ChartErrorProps) {
  const errorMessage = _error instanceof Error ? _error.message : error || "Failed to load chart data"

  return (
    <Card className="h-full">
      <CardContent 
        className="flex flex-col items-center justify-center text-center p-6"
        style={{ minHeight: `${height}px` }}
      >
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Unable to Load Chart</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {errorMessage}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}