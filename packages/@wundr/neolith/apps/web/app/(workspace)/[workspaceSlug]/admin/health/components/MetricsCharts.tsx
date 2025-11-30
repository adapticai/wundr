'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricsChartData } from '@neolith/core/src/types/health-dashboard';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface MetricsChartsProps {
  data: MetricsChartData;
}

export function MetricsCharts({ data }: MetricsChartsProps) {
  // Transform data for recharts
  const sessionsData = data.sessions.map((point) => ({
    timestamp: format(new Date(point.timestamp), 'HH:mm'),
    sessions: point.value,
  }));

  const tokensData = data.tokens.map((point) => ({
    timestamp: format(new Date(point.timestamp), 'HH:mm'),
    tokens: point.value,
  }));

  // Combine latency percentiles into single array
  const latencyData = data.latency.p50.map((point, index) => ({
    timestamp: format(new Date(point.timestamp), 'HH:mm'),
    p50: point.value,
    p95: data.latency.p95[index]?.value || 0,
    p99: data.latency.p99[index]?.value || 0,
  }));

  const errorsData = data.errors.map((point) => ({
    timestamp: format(new Date(point.timestamp), 'HH:mm'),
    errors: point.value,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Sessions Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions Over Time</CardTitle>
          <CardDescription>Active session count trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sessionsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Token Usage Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Token Usage Over Time</CardTitle>
          <CardDescription>Token consumption trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tokensData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Latency Percentiles */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Percentiles</CardTitle>
          <CardDescription>Response time distribution (p50, p95, p99)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{
                  value: 'ms',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'hsl(var(--muted-foreground))' },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="#10b981"
                strokeWidth={2}
                name="p50 (median)"
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke="#f59e0b"
                strokeWidth={2}
                name="p95"
              />
              <Line
                type="monotone"
                dataKey="p99"
                stroke="#ef4444"
                strokeWidth={2}
                name="p99"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Errors Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Errors By Type</CardTitle>
          <CardDescription>Error count distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Bar
                dataKey="errors"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="Error Count"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
