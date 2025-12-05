'use client';

/**
 * AI Cost Breakdown Component
 *
 * Detailed cost analysis and reporting:
 * - Cost trends over time
 * - Cost by model comparison
 * - Cost by user breakdown
 * - Projected monthly costs
 * - Export usage reports
 *
 * @module components/admin/ai-cost-breakdown
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface UsageSummary {
  last24Hours: { tokens: number; cost: number; requests: number };
  last7Days: { tokens: number; cost: number; requests: number };
  last30Days: { tokens: number; cost: number; requests: number };
  allTime: { tokens: number; cost: number; requests: number };
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

interface AICostBreakdownProps {
  summary: UsageSummary;
  usageByModel: ModelUsage[];
  usageByUser: UserUsage[];
  workspaceSlug: string;
}

export function AICostBreakdown({
  summary,
  usageByModel,
  usageByUser,
  workspaceSlug,
}: AICostBreakdownProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Calculate projections
  const dailyAverage = summary.last30Days.cost / 30;
  const projectedMonthlyCost = dailyAverage * 30;
  const last7DaysAverage = summary.last7Days.cost / 7;
  const trend = ((last7DaysAverage - dailyAverage) / dailyAverage) * 100;

  // Calculate cost per request
  const costPerRequest = summary.allTime.cost / summary.allTime.requests;

  // Sort data
  const sortedByModel = [...usageByModel].sort((a, b) => b.cost - a.cost);
  const sortedByUser = [...usageByUser].sort((a, b) => b.cost - a.cost);

  const handleExportReport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/ai/export?format=${format}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-usage-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Cost Overview */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='pb-3'>
            <CardDescription>Daily Average</CardDescription>
            <CardTitle className='text-3xl'>
              ${dailyAverage.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              {trend > 0 ? (
                <>
                  <TrendingUp className='h-4 w-4 text-red-500' />
                  <span className='text-red-500'>+{trend.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className='h-4 w-4 text-green-500' />
                  <span className='text-green-500'>{trend.toFixed(1)}%</span>
                </>
              )}
              <span>vs. 30d average</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <CardDescription>Projected Monthly</CardDescription>
            <CardTitle className='text-3xl'>
              ${projectedMonthlyCost.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-sm text-muted-foreground'>
              Based on last 30 days usage
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <CardDescription>Cost per Request</CardDescription>
            <CardTitle className='text-3xl'>
              ${costPerRequest.toFixed(4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-sm text-muted-foreground'>
              Average across all requests
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <div className='flex justify-end gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => handleExportReport('csv')}
          disabled={isExporting}
        >
          <Download className='h-4 w-4 mr-2' />
          Export CSV
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => handleExportReport('json')}
          disabled={isExporting}
        >
          <Download className='h-4 w-4 mr-2' />
          Export JSON
        </Button>
      </div>

      {/* Cost by Model */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Model</CardTitle>
          <CardDescription>Total cost breakdown by AI model</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className='text-right'>Requests</TableHead>
                <TableHead className='text-right'>Input Tokens</TableHead>
                <TableHead className='text-right'>Output Tokens</TableHead>
                <TableHead className='text-right'>Total Cost</TableHead>
                <TableHead className='text-right'>% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedByModel.map(model => {
                const percentage = (model.cost / summary.allTime.cost) * 100;
                return (
                  <TableRow key={model.model}>
                    <TableCell className='font-medium'>{model.model}</TableCell>
                    <TableCell className='text-right'>
                      {model.requests.toLocaleString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      {(model.inputTokens / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className='text-right'>
                      {(model.outputTokens / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className='text-right'>
                      ${model.cost.toFixed(2)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Badge variant='secondary'>
                        {percentage.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cost by User */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by User</CardTitle>
          <CardDescription>Per-user usage and cost breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className='text-right'>Requests</TableHead>
                <TableHead className='text-right'>Input Tokens</TableHead>
                <TableHead className='text-right'>Output Tokens</TableHead>
                <TableHead className='text-right'>Total Cost</TableHead>
                <TableHead className='text-right'>Avg Cost/Request</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedByUser.map(user => {
                const avgCostPerRequest = user.cost / user.requestCount;
                return (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <div className='font-medium'>{user.userName}</div>
                        <div className='text-sm text-muted-foreground'>
                          {user.userEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>
                      {user.requestCount.toLocaleString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      {(user.inputTokens / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className='text-right'>
                      {(user.outputTokens / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className='text-right'>
                      ${user.cost.toFixed(2)}
                    </TableCell>
                    <TableCell className='text-right'>
                      ${avgCostPerRequest.toFixed(4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Time Period Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Time Period Comparison</CardTitle>
          <CardDescription>
            Cost and usage across different time periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className='text-right'>Requests</TableHead>
                <TableHead className='text-right'>Tokens</TableHead>
                <TableHead className='text-right'>Total Cost</TableHead>
                <TableHead className='text-right'>Avg Cost/Request</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className='font-medium'>Last 24 Hours</TableCell>
                <TableCell className='text-right'>
                  {summary.last24Hours.requests.toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>
                  {(summary.last24Hours.tokens / 1000).toFixed(1)}K
                </TableCell>
                <TableCell className='text-right'>
                  ${summary.last24Hours.cost.toFixed(2)}
                </TableCell>
                <TableCell className='text-right'>
                  $
                  {(
                    summary.last24Hours.cost / summary.last24Hours.requests
                  ).toFixed(4)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='font-medium'>Last 7 Days</TableCell>
                <TableCell className='text-right'>
                  {summary.last7Days.requests.toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>
                  {(summary.last7Days.tokens / 1000).toFixed(1)}K
                </TableCell>
                <TableCell className='text-right'>
                  ${summary.last7Days.cost.toFixed(2)}
                </TableCell>
                <TableCell className='text-right'>
                  $
                  {(
                    summary.last7Days.cost / summary.last7Days.requests
                  ).toFixed(4)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='font-medium'>Last 30 Days</TableCell>
                <TableCell className='text-right'>
                  {summary.last30Days.requests.toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>
                  {(summary.last30Days.tokens / 1000).toFixed(1)}K
                </TableCell>
                <TableCell className='text-right'>
                  ${summary.last30Days.cost.toFixed(2)}
                </TableCell>
                <TableCell className='text-right'>
                  $
                  {(
                    summary.last30Days.cost / summary.last30Days.requests
                  ).toFixed(4)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='font-medium'>All Time</TableCell>
                <TableCell className='text-right'>
                  {summary.allTime.requests.toLocaleString()}
                </TableCell>
                <TableCell className='text-right'>
                  {(summary.allTime.tokens / 1000).toFixed(1)}K
                </TableCell>
                <TableCell className='text-right'>
                  ${summary.allTime.cost.toFixed(2)}
                </TableCell>
                <TableCell className='text-right'>
                  $
                  {(summary.allTime.cost / summary.allTime.requests).toFixed(4)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
