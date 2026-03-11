'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

// Typed shape for a single data point returned by /api/dashboard/overview
export interface OverviewDataPoint {
  name: string;
  total: number;
  tests: number;
  coverage: number;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: OverviewDataPoint[] };

function useOverviewData(): FetchState {
  const [state, setState] = React.useState<FetchState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setState({ status: 'loading' });
      try {
        const response = await fetch('/api/dashboard/overview');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json: OverviewDataPoint[] = await response.json();
        if (!cancelled) {
          setState({ status: 'success', data: json });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Failed to load overview data',
          });
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function Overview() {
  const fetchState = useOverviewData();

  if (fetchState.status === 'loading') {
    return (
      <div
        data-testid='overview-chart'
        data-has-data='false'
        className='flex items-center justify-center h-[350px] text-muted-foreground text-sm'
      >
        Loading overview data...
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div
        data-testid='overview-chart'
        data-has-data='false'
        className='flex flex-col items-center justify-center h-[350px] text-destructive text-sm gap-1'
      >
        <span>Failed to load overview data</span>
        <span className='text-muted-foreground text-xs'>
          {fetchState.message}
        </span>
      </div>
    );
  }

  const data = fetchState.data;

  return (
    <div
      data-testid='overview-chart'
      data-has-data={data.length > 0 ? 'true' : 'false'}
    >
      <ResponsiveContainer width='100%' height={350}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id='colorTotal' x1='0' y1='0' x2='0' y2='1'>
              <stop
                offset='5%'
                stopColor='hsl(var(--primary))'
                stopOpacity={0.8}
              />
              <stop
                offset='95%'
                stopColor='hsl(var(--primary))'
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='name'
            stroke='hsl(var(--muted-foreground))'
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke='hsl(var(--muted-foreground))'
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={value => `${value}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className='rounded-lg border bg-background p-2 shadow-sm'>
                    <div className='grid grid-cols-2 gap-2'>
                      <div className='flex flex-col'>
                        <span className='text-[0.70rem] uppercase text-muted-foreground'>
                          {label}
                        </span>
                        <span className='font-bold text-muted-foreground'>
                          {payload[0].value}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type='monotone'
            dataKey='total'
            stroke='hsl(var(--primary))'
            fillOpacity={1}
            fill='url(#colorTotal)'
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
