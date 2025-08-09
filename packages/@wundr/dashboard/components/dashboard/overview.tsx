'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { useTheme } from 'next-themes'

// Mock data for the overview chart
const data = [
  { name: 'Jan', total: 2400, tests: 1200, coverage: 78 },
  { name: 'Feb', total: 1398, tests: 1100, coverage: 82 },
  { name: 'Mar', total: 9800, tests: 1300, coverage: 85 },
  { name: 'Apr', total: 3908, tests: 1400, coverage: 88 },
  { name: 'May', total: 4800, tests: 1500, coverage: 91 },
  { name: 'Jun', total: 3800, tests: 1600, coverage: 89 },
  { name: 'Jul', total: 4300, tests: 1650, coverage: 92 }
]

export function Overview() {
  const { theme } = useTheme()

  return (
    <div data-testid="overview-chart" data-has-data={data.length > 0 ? "true" : "false"}>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                        {label}
                      </span>
                      <span className="font-bold text-muted-foreground">
                        {payload[0].value}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="hsl(var(--primary))"
          fillOpacity={1}
          fill="url(#colorTotal)"
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}