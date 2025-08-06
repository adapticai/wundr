import React from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ChartLoadingProps {
  message?: string
  height?: number
}

export function ChartLoading({ message = "Loading chart data...", height = 300 }: ChartLoadingProps) {
  return (
    <Card className="h-full">
      <CardContent 
        className="flex flex-col items-center justify-center text-center p-6"
        style={{ minHeight: `${height}px` }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}