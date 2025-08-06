"use client"

import React, { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import { format, startOfWeek, eachDayOfInterval, subDays } from "date-fns"

interface GitActivity {
  date: string
  commits: number
  additions: number
  deletions: number
  files: number
}

interface GitActivityHeatmapProps {
  activities: GitActivity[]
  days?: number
}

export function GitActivityHeatmap({ activities, days = 365 }: GitActivityHeatmapProps) {
  const { theme } = useTheme()

  const processedData = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    
    // Create a map of activities by date
    const activityMap = new Map(
      activities.map(a => [a.date, a])
    )

    // Generate all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate })
    
    // Group by weeks
    const weeks: { startDate: Date; days: (GitActivity | null)[] }[] = []
    let currentWeek: (GitActivity | null)[] = []
    let weekStart = startOfWeek(startDate)

    allDays.forEach(day => {
      const dayStr = format(day, "yyyy-MM-dd")
      const activity = activityMap.get(dayStr) || null
      
      if (startOfWeek(day).getTime() !== weekStart.getTime()) {
        if (currentWeek.length > 0) {
          weeks.push({ startDate: weekStart, days: currentWeek })
        }
        currentWeek = []
        weekStart = startOfWeek(day)
      }
      
      currentWeek.push(activity)
    })

    if (currentWeek.length > 0) {
      weeks.push({ startDate: weekStart, days: currentWeek })
    }

    return weeks
  }, [activities, days])

  const getIntensity = (commits: number) => {
    if (commits === 0) return 0
    if (commits <= 2) return 1
    if (commits <= 5) return 2
    if (commits <= 10) return 3
    return 4
  }

  const getColor = (intensity: number) => {
    const colors = theme === "dark" 
      ? ["#0e1117", "#0e4429", "#006d32", "#26a641", "#39d353"]
      : ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"]
    
    return colors[intensity]
  }

  const months = useMemo(() => {
    const monthsSet = new Set<string>()
    processedData.forEach(week => {
      const month = format(week.startDate, "MMM")
      monthsSet.add(month)
    })
    return Array.from(monthsSet)
  }, [processedData])

  const stats = useMemo(() => {
    const totalCommits = activities.reduce((sum, a) => sum + a.commits, 0)
    const totalAdditions = activities.reduce((sum, a) => sum + a.additions, 0)
    const totalDeletions = activities.reduce((sum, a) => sum + a.deletions, 0)
    const activeDays = activities.filter(a => a.commits > 0).length
    
    return {
      totalCommits,
      totalAdditions,
      totalDeletions,
      activeDays,
      avgCommitsPerDay: (totalCommits / days).toFixed(1),
      longestStreak: calculateLongestStreak(activities),
      currentStreak: calculateCurrentStreak(activities),
    }
  }, [activities, days])

  function calculateLongestStreak(activities: GitActivity[]) {
    let maxStreak = 0
    let currentStreak = 0
    
    activities
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((activity, index, arr) => {
        if (activity.commits > 0) {
          if (index === 0 || isConsecutiveDay(arr[index - 1].date, activity.date)) {
            currentStreak++
            maxStreak = Math.max(maxStreak, currentStreak)
          } else {
            currentStreak = 1
          }
        } else {
          currentStreak = 0
        }
      })
    
    return maxStreak
  }

  function calculateCurrentStreak(activities: GitActivity[]) {
    const sorted = activities.sort((a, b) => b.date.localeCompare(a.date))
    let streak = 0
    
    for (const activity of sorted) {
      if (activity.commits > 0) {
        streak++
      } else {
        break
      }
    }
    
    return streak
  }

  function isConsecutiveDay(date1: string, date2: string) {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays === 1
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Git Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.totalCommits}</div>
                <div className="text-sm text-muted-foreground">Total Commits</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.activeDays}</div>
                <div className="text-sm text-muted-foreground">Active Days</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.currentStreak}</div>
                <div className="text-sm text-muted-foreground">Current Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.longestStreak}</div>
                <div className="text-sm text-muted-foreground">Longest Streak</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-block">
                <div className="flex gap-1 mb-2">
                  <div className="w-3"></div>
                  {months.map((month, i) => (
                    <div key={i} className="text-xs text-muted-foreground w-12">
                      {month}
                    </div>
                  ))}
                </div>
                
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dayIndex) => (
                  <div key={day} className="flex gap-1 mb-1">
                    <div className="text-xs text-muted-foreground w-3">
                      {dayIndex % 2 === 0 ? day[0] : ""}
                    </div>
                    {processedData.map((week, weekIndex) => {
                      const activity = week.days[dayIndex]
                      if (!activity && weekIndex === 0 && dayIndex < week.days.length) {
                        return <div key={weekIndex} className="w-3 h-3" />
                      }
                      
                      if (!activity) return null
                      
                      const intensity = activity ? getIntensity(activity.commits) : 0
                      const color = getColor(intensity)
                      
                      return (
                        <TooltipProvider key={weekIndex}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="w-3 h-3 rounded-sm cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary"
                                style={{ backgroundColor: color }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-semibold">{activity.date}</div>
                                <div>{activity.commits} commits</div>
                                <div className="text-green-500">+{activity.additions}</div>
                                <div className="text-red-500">-{activity.deletions}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                ))}
                
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: getColor(i) }}
                    />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}