'use client';

/**
 * AI Usage Chart Component
 *
 * Visualizes AI usage metrics with interactive charts:
 * - Daily token usage over time
 * - Usage by model distribution
 * - Usage by user breakdown
 * - Request trends
 *
 * Uses recharts for visualization
 *
 * @module components/admin/ai-usage-chart
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requests: number;
}

interface UserUsage {
  userId: string;
  userName: string;
  userEmail: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestCount: number;
}

interface AIUsageChartProps {
  data: DailyUsage[];
  usageByModel: ModelUsage[];
  usageByUser: UserUsage[];
}

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
  '#FFC658',
  '#FF6B9D',
];

export function AIUsageChart({
  data,
  usageByModel,
  usageByUser,
}: AIUsageChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Format daily data for charts
  const dailyData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    tokens: d.tokens / 1000, // Convert to K tokens
    cost: d.cost,
  }));

  // Format model data for pie chart
  const modelData = usageByModel.map(m => ({
    name: m.model,
    value: m.tokens,
    cost: m.cost,
    requests: m.requests,
  }));

  // Format user data for bar chart
  const userData = usageByUser
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 10)
    .map(u => ({
      name: u.userName || u.userEmail.split('@')[0],
      tokens: u.totalTokens / 1000,
      cost: u.cost,
      requests: u.requestCount,
    }));

  return (
    <div className='space-y-6'>
      {/* Daily Usage Trends */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold'>Daily Usage Trends</h3>
          <div className='flex gap-2'>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded-md text-sm ${
                chartType === 'line'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 rounded-md text-sm ${
                chartType === 'bar'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Bar
            </button>
          </div>
        </div>

        <ResponsiveContainer width='100%' height={300}>
          {chartType === 'line' ? (
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' />
              <YAxis yAxisId='left' />
              <YAxis yAxisId='right' orientation='right' />
              <Tooltip />
              <Legend />
              <Line
                yAxisId='left'
                type='monotone'
                dataKey='tokens'
                stroke='#8884d8'
                name='Tokens (K)'
                strokeWidth={2}
              />
              <Line
                yAxisId='right'
                type='monotone'
                dataKey='cost'
                stroke='#82ca9d'
                name='Cost ($)'
                strokeWidth={2}
              />
            </LineChart>
          ) : (
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' />
              <YAxis yAxisId='left' />
              <YAxis yAxisId='right' orientation='right' />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId='left'
                dataKey='tokens'
                fill='#8884d8'
                name='Tokens (K)'
              />
              <Bar
                yAxisId='right'
                dataKey='cost'
                fill='#82ca9d'
                name='Cost ($)'
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Model and User Distribution */}
      <div className='grid gap-6 md:grid-cols-2'>
        {/* Usage by Model */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Usage by Model</CardTitle>
            <CardDescription>
              Token distribution across AI models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <PieChart>
                <Pie
                  data={modelData}
                  cx='50%'
                  cy='50%'
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill='#8884d8'
                  dataKey='value'
                >
                  {modelData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${(value / 1000).toFixed(1)}K tokens`,
                    props.payload.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className='mt-4 space-y-2'>
              {modelData.map((m, index) => (
                <div
                  key={m.name}
                  className='flex items-center justify-between text-sm'
                >
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-3 h-3 rounded-full'
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{m.name}</span>
                  </div>
                  <div className='text-muted-foreground'>
                    {m.requests} requests • ${m.cost.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Top Users</CardTitle>
            <CardDescription>Top 10 users by token usage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <BarChart data={userData} layout='vertical'>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis type='number' />
                <YAxis dataKey='name' type='category' width={100} />
                <Tooltip />
                <Bar dataKey='tokens' fill='#8884d8' name='Tokens (K)' />
              </BarChart>
            </ResponsiveContainer>

            <div className='mt-4 space-y-2'>
              {userData.map(u => (
                <div
                  key={u.name}
                  className='flex items-center justify-between text-sm'
                >
                  <span className='font-medium'>{u.name}</span>
                  <div className='text-muted-foreground'>
                    {u.requests} requests • ${u.cost.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
