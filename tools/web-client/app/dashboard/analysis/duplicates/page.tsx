"use client"

import { useAnalysis } from "@/lib/contexts/analysis-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Code, Brain, Download } from "lucide-react"
import { useState } from "react"

export default function DuplicatesPage() {
  const { data, loading } = useAnalysis()
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Duplicate Code Analysis</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-muted-foreground">No analysis data available</p>
      </div>
    )
  }

  const filteredDuplicates = data.duplicates.filter((duplicate) => {
    if (severityFilter !== "all" && duplicate.severity !== severityFilter) {
      return false
    }
    if (typeFilter !== "all" && duplicate.type !== typeFilter) {
      return false
    }
    return true
  })

  const exportDuplicates = () => {
    const jsonStr = JSON.stringify(filteredDuplicates, null, 2)
    const blob = new Blob([jsonStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "duplicates-report.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const severityColors = {
    critical: "destructive",
    high: "warning",
    medium: "default",
  } as const

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Duplicate Code Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Found {data.duplicates.length} duplicate clusters in your codebase
          </p>
        </div>
        <Button onClick={exportDuplicates} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex gap-2">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="class">Classes</SelectItem>
            <SelectItem value="interface">Interfaces</SelectItem>
            <SelectItem value="function">Functions</SelectItem>
            <SelectItem value="type">Types</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredDuplicates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No duplicates found with current filters
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDuplicates.map((cluster) => (
            <Card key={cluster.hash}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {cluster.entities.length} duplicate {cluster.type}s
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={severityColors[cluster.severity]}>
                      {cluster.severity.toUpperCase()}
                    </Badge>
                    {cluster.structuralMatch && (
                      <Badge variant="outline">
                        <Code className="mr-1 h-3 w-3" />
                        Structural
                      </Badge>
                    )}
                    {cluster.semanticMatch && (
                      <Badge variant="outline">
                        <Brain className="mr-1 h-3 w-3" />
                        Semantic
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cluster.entities.map((entity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{entity.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entity.file}:{entity.line}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}