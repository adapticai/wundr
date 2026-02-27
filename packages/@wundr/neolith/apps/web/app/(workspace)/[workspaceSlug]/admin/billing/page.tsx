'use client';

import {
  AlertCircle,
  CreditCard,
  Download,
  Mail,
  TrendingUp,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from '@/lib/utils';

type BillingInterval = 'monthly' | 'yearly';
type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';

interface Plan {
  id: PlanTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  popular?: boolean;
  features: string[];
  limits: {
    members: number | string;
    storage: string;
    apiCalls: string;
  };
}

interface BillingData {
  plan: PlanTier;
  planName: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  usage: {
    members: number;
    membersLimit: number;
    storage: number;
    storageLimit: number;
    channels: number;
    channelsLimit: number;
    apiCalls: number;
    apiCallsLimit: number;
  };
  features: string[];
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl?: string;
}

interface BudgetAlert {
  id: string;
  threshold: number;
  enabled: boolean;
  notifyEmail: boolean;
  notifySlack: boolean;
}

interface UsageHistory {
  date: string;
  members: number;
  storage: number;
  apiCalls: number;
  cost: number;
}

/**
 * Comprehensive Admin Billing Page
 *
 * Features:
 * - Current plan details with real-time usage metrics
 * - Plan comparison and upgrade options
 * - Payment method management
 * - Billing history and invoice downloads
 * - Usage visualization with charts
 * - Cost alerts and budget settings
 * - Enterprise contact form
 */
export default function AdminBillingPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEnterpriseDialog, setShowEnterpriseDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Billing & Subscription',
      'Manage your subscription, payment methods, and billing settings'
    );
  }, [setPageHeader]);

  // Fetch billing data
  const fetchBillingData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [billingRes, paymentsRes, invoicesRes, usageRes, alertsRes] =
        await Promise.all([
          fetch(`/api/workspaces/${workspaceSlug}/admin/billing`),
          fetch(
            `/api/workspaces/${workspaceSlug}/admin/billing/payment-methods`
          ),
          fetch(`/api/workspaces/${workspaceSlug}/admin/billing/invoices`),
          fetch(`/api/workspaces/${workspaceSlug}/admin/billing/usage-history`),
          fetch(`/api/workspaces/${workspaceSlug}/admin/billing/budget-alerts`),
        ]);

      if (billingRes.ok) {
        const data = await billingRes.json();
        setBilling(data.billing);
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPaymentMethods(data.paymentMethods || []);
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsageHistory(data.history || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setBudgetAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void fetchBillingData();
  }, [fetchBillingData]);

  const handleUpgrade = useCallback(
    async (planId: PlanTier) => {
      if (planId === 'ENTERPRISE') {
        setShowEnterpriseDialog(true);
        return;
      }

      setIsUpgrading(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/admin/billing/upgrade`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: planId }),
          }
        );

        if (!res.ok) {
          throw new Error('Failed to upgrade plan');
        }

        const data = await res.json();
        setBilling(data.billing);
        setSelectedPlan(null);

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      } catch (error) {
        console.error('Upgrade failed:', error);
        toast.error('Failed to upgrade plan. Please try again.');
      } finally {
        setIsUpgrading(false);
      }
    },
    [workspaceSlug]
  );

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/billing/invoices/${invoiceId}/download`
      );
      if (!res.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download invoice. Please try again.');
    }
  };

  const plans: Plan[] = [
    {
      id: 'FREE',
      name: 'Free',
      description: 'For small teams getting started',
      priceMonthly: 0,
      priceYearly: 0,
      features: [
        'Up to 10 members',
        '5 GB storage',
        '10,000 API calls/month',
        'Basic integrations',
        'Community support',
      ],
      limits: {
        members: 10,
        storage: '5 GB',
        apiCalls: '10,000/month',
      },
    },
    {
      id: 'STARTER',
      name: 'Starter',
      description: 'For growing teams',
      priceMonthly: 12,
      priceYearly: 120,
      features: [
        'Up to 50 members',
        '50 GB storage',
        '100,000 API calls/month',
        'Advanced integrations',
        'Email support',
        'Custom roles',
      ],
      limits: {
        members: 50,
        storage: '50 GB',
        apiCalls: '100,000/month',
      },
    },
    {
      id: 'PROFESSIONAL',
      name: 'Professional',
      description: 'For professional teams',
      priceMonthly: 29,
      priceYearly: 290,
      popular: true,
      features: [
        'Up to 250 members',
        '500 GB storage',
        '1M API calls/month',
        'All integrations',
        'Priority support',
        'Advanced permissions',
        'SSO authentication',
        'Audit logs',
      ],
      limits: {
        members: 250,
        storage: '500 GB',
        apiCalls: '1M/month',
      },
    },
    {
      id: 'BUSINESS',
      name: 'Business',
      description: 'For large organizations',
      priceMonthly: 99,
      priceYearly: 990,
      features: [
        'Up to 500 members',
        '1 TB storage',
        '10M API calls/month',
        'All integrations',
        'Dedicated support',
        'Advanced security',
        'SAML SSO',
        'Advanced analytics',
      ],
      limits: {
        members: 500,
        storage: '1 TB',
        apiCalls: '10M/month',
      },
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'For enterprises with custom needs',
      priceMonthly: 0,
      priceYearly: 0,
      features: [
        'Unlimited members',
        'Unlimited storage',
        'Unlimited API calls',
        'Custom integrations',
        '24/7 dedicated support',
        'Enterprise SLA',
        'Custom contracts',
        'On-premise deployment',
        'Dedicated infrastructure',
      ],
      limits: {
        members: 'Unlimited',
        storage: 'Unlimited',
        apiCalls: 'Unlimited',
      },
    },
  ];

  const currentPlan = plans.find(p => p.id === billing?.plan) || plans[0];

  if (isLoading) {
    return <BillingPageSkeleton />;
  }

  return (
    <div className='space-y-8'>
      {/* Alert for canceled subscription */}
      {billing?.cancelAtPeriodEnd && (
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Your subscription will be canceled at the end of the billing period
            on {new Date(billing.currentPeriodEnd).toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue='overview' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='plans'>Plans</TabsTrigger>
          <TabsTrigger value='payment'>Payment Methods</TabsTrigger>
          <TabsTrigger value='invoices'>Billing History</TabsTrigger>
          <TabsTrigger value='usage'>Usage & Analytics</TabsTrigger>
          <TabsTrigger value='alerts'>Budget Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-6'>
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    {currentPlan.name} Plan
                    {billing?.status === 'active' && (
                      <Badge variant='default' className='ml-2'>
                        Active
                      </Badge>
                    )}
                    {billing?.status === 'trialing' && (
                      <Badge variant='secondary' className='ml-2'>
                        Trial
                      </Badge>
                    )}
                    {billing?.status === 'past_due' && (
                      <Badge variant='destructive' className='ml-2'>
                        Past Due
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{currentPlan.description}</CardDescription>
                </div>
                <div className='text-right'>
                  <p className='text-3xl font-bold'>
                    $
                    {billingInterval === 'monthly'
                      ? currentPlan.priceMonthly
                      : Math.round(currentPlan.priceYearly / 12)}
                    <span className='text-base font-normal text-muted-foreground'>
                      /month
                    </span>
                  </p>
                  {billingInterval === 'yearly' &&
                    currentPlan.priceYearly > 0 && (
                      <p className='text-sm text-muted-foreground'>
                        Billed ${currentPlan.priceYearly}/year
                      </p>
                    )}
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              {billing?.currentPeriodEnd && (
                <p className='text-sm text-muted-foreground'>
                  {billing.status === 'canceled'
                    ? `Subscription ends on ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                    : `Next billing date: ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              )}

              {/* Usage Statistics */}
              <div className='grid gap-4 md:grid-cols-3'>
                <UsageMetric
                  label='Members'
                  current={billing?.usage.members || 0}
                  limit={billing?.usage.membersLimit || 0}
                  unit=''
                />
                <UsageMetric
                  label='Storage'
                  current={billing?.usage.storage || 0}
                  limit={billing?.usage.storageLimit || 0}
                  unit='GB'
                />
                <UsageMetric
                  label='API Calls'
                  current={billing?.usage.apiCalls || 0}
                  limit={billing?.usage.apiCallsLimit || 0}
                  unit='calls'
                />
              </div>

              {/* Quick Actions */}
              <div className='flex gap-2'>
                {currentPlan.id !== 'ENTERPRISE' && (
                  <Button onClick={() => setSelectedPlan('PROFESSIONAL')}>
                    Upgrade Plan
                  </Button>
                )}
                <Button
                  variant='outline'
                  onClick={() => setShowPaymentDialog(true)}
                >
                  <CreditCard className='mr-2 h-4 w-4' />
                  Manage Payment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <StatsCard
              title='Subscription Cost'
              value={
                currentPlan.priceMonthly === 0
                  ? 'Free'
                  : `$${billingInterval === 'monthly' ? currentPlan.priceMonthly : Math.round(currentPlan.priceYearly / 12)}/mo`
              }
              description={
                billingInterval === 'yearly'
                  ? `$${currentPlan.priceYearly}/year billed annually`
                  : 'Billed monthly'
              }
            />
            <StatsCard
              title='Total Invoices'
              value={invoices.length.toString()}
              description='All time'
            />
            <StatsCard
              title='Storage Used'
              value={`${billing?.usage.storage || 0} GB`}
              description={`of ${billing?.usage.storageLimit || 0} GB`}
            />
            <StatsCard
              title='API Calls'
              value={formatNumber(billing?.usage.apiCalls || 0)}
              description='This month'
            />
          </div>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value='plans' className='space-y-6'>
          {/* Billing Interval Toggle */}
          <div className='flex items-center justify-center gap-4'>
            <Button
              variant={billingInterval === 'monthly' ? 'default' : 'outline'}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingInterval === 'yearly' ? 'default' : 'outline'}
              onClick={() => setBillingInterval('yearly')}
            >
              Yearly
              <Badge variant='secondary' className='ml-2'>
                Save 20%
              </Badge>
            </Button>
          </div>

          {/* Plan Comparison */}
          <div className='grid gap-6 lg:grid-cols-3'>
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingInterval={billingInterval}
                isCurrentPlan={plan.id === billing?.plan}
                onSelect={() => setSelectedPlan(plan.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value='payment' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>Manage your payment methods</CardDescription>
                </div>
                <Button onClick={() => setShowPaymentDialog(true)}>
                  Add Payment Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentMethods.length > 0 ? (
                <div className='space-y-4'>
                  {paymentMethods.map(method => (
                    <PaymentMethodCard key={method.id} method={method} />
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                  <CreditCard className='mb-4 h-12 w-12 text-muted-foreground' />
                  <h3 className='mb-1 text-lg font-semibold'>
                    No payment methods on file
                  </h3>
                  <p className='mb-6 max-w-sm text-sm text-muted-foreground'>
                    Add a payment method to manage your subscription and enable
                    plan upgrades.
                  </p>
                  <Button onClick={() => setShowPaymentDialog(true)}>
                    <CreditCard className='mr-2 h-4 w-4' />
                    Add Payment Method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value='invoices' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View and download past invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className='font-medium'>
                          #{invoice.number}
                        </TableCell>
                        <TableCell>
                          {new Date(invoice.periodStart).toLocaleDateString()} -{' '}
                          {new Date(invoice.periodEnd).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          ${(invoice.amount / 100).toFixed(2)}{' '}
                          {invoice.currency.toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === 'paid'
                                ? 'default'
                                : invoice.status === 'pending'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleDownloadInvoice(invoice.id)}
                          >
                            <Download className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                  <Download className='mb-4 h-12 w-12 text-muted-foreground' />
                  <h3 className='mb-1 text-lg font-semibold'>
                    No invoices yet
                  </h3>
                  <p className='max-w-sm text-sm text-muted-foreground'>
                    Invoices will appear here after your first billing cycle.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage & Analytics Tab */}
        <TabsContent value='usage' className='space-y-6'>
          <div className='grid gap-6 lg:grid-cols-2'>
            {/* Storage Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Usage Trend</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    storage: {
                      label: 'Storage (GB)',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className='h-[300px]'
                >
                  <AreaChart data={usageHistory}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis
                      dataKey='date'
                      tickFormatter={value =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type='monotone'
                      dataKey='storage'
                      stroke='var(--color-storage)'
                      fill='var(--color-storage)'
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* API Calls Chart */}
            <Card>
              <CardHeader>
                <CardTitle>API Calls</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    apiCalls: {
                      label: 'API Calls',
                      color: 'hsl(var(--chart-2))',
                    },
                  }}
                  className='h-[300px]'
                >
                  <BarChart data={usageHistory}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis
                      dataKey='date'
                      tickFormatter={value =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey='apiCalls' fill='var(--color-apiCalls)' />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Trend</CardTitle>
                <CardDescription>Monthly spending over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    cost: {
                      label: 'Cost ($)',
                      color: 'hsl(var(--chart-3))',
                    },
                  }}
                  className='h-[300px]'
                >
                  <AreaChart data={usageHistory}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis
                      dataKey='date'
                      tickFormatter={value =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type='monotone'
                      dataKey='cost'
                      stroke='var(--color-cost)'
                      fill='var(--color-cost)'
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Members Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Team Growth</CardTitle>
                <CardDescription>Member count over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    members: {
                      label: 'Members',
                      color: 'hsl(var(--chart-4))',
                    },
                  }}
                  className='h-[300px]'
                >
                  <AreaChart data={usageHistory}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis
                      dataKey='date'
                      tickFormatter={value =>
                        new Date(value).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type='monotone'
                      dataKey='members'
                      stroke='var(--color-members)'
                      fill='var(--color-members)'
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Budget Alerts Tab */}
        <TabsContent value='alerts' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Budget Alerts</CardTitle>
                  <CardDescription>
                    Set up alerts for usage thresholds
                  </CardDescription>
                </div>
                <Button onClick={() => setShowBudgetDialog(true)}>
                  Create Alert
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {budgetAlerts.length > 0 ? (
                <div className='space-y-4'>
                  {budgetAlerts.map(alert => (
                    <BudgetAlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                  <AlertCircle className='mb-4 h-12 w-12 text-muted-foreground' />
                  <h3 className='mb-1 text-lg font-semibold'>
                    No budget alerts configured
                  </h3>
                  <p className='mb-6 max-w-sm text-sm text-muted-foreground'>
                    Set up alerts to be notified when your spending reaches a
                    threshold, so you can avoid unexpected charges.
                  </p>
                  <Button onClick={() => setShowBudgetDialog(true)}>
                    Create Alert
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade Modal */}
      {selectedPlan && selectedPlan !== billing?.plan && (
        <UpgradeModal
          plan={plans.find(p => p.id === selectedPlan)!}
          billingInterval={billingInterval}
          isUpgrading={isUpgrading}
          onConfirm={() => handleUpgrade(selectedPlan)}
          onClose={() => setSelectedPlan(null)}
        />
      )}

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onSuccess={fetchBillingData}
        workspaceSlug={workspaceSlug}
      />

      {/* Enterprise Contact Dialog */}
      <EnterpriseContactDialog
        open={showEnterpriseDialog}
        onClose={() => setShowEnterpriseDialog(false)}
        workspaceSlug={workspaceSlug}
      />

      {/* Budget Alert Dialog */}
      <BudgetAlertDialog
        open={showBudgetDialog}
        onClose={() => setShowBudgetDialog(false)}
        onSuccess={fetchBillingData}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}

// Helper Components

function UsageMetric({
  label,
  current,
  limit,
  unit,
}: {
  label: string;
  current: number;
  limit: number;
  unit: string;
}) {
  const percentage = limit <= 0 ? 0 : Math.min((current / limit) * 100, 100);
  const isUnlimited = limit === -1;

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <p className='text-2xl font-bold'>
            {current.toLocaleString()} {unit}
          </p>
          {!isUnlimited && (
            <>
              <p className='text-sm text-muted-foreground'>
                of {limit.toLocaleString()} {unit}
              </p>
              <Progress value={percentage} className='h-2' />
              <p className='text-xs text-muted-foreground'>
                {percentage.toFixed(0)}% used
              </p>
            </>
          )}
          {isUnlimited && (
            <p className='text-sm text-muted-foreground'>Unlimited</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCard({
  title,
  value,
  description,
  trend,
}: {
  title: string;
  value: string;
  description: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='flex items-baseline justify-between'>
          <p className='text-2xl font-bold'>{value}</p>
          {trend && (
            <span className='flex items-center text-sm text-green-600'>
              <TrendingUp className='mr-1 h-3 w-3' />
              {trend}
            </span>
          )}
        </div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  billingInterval,
  isCurrentPlan,
  onSelect,
}: {
  plan: Plan;
  billingInterval: BillingInterval;
  isCurrentPlan: boolean;
  onSelect: () => void;
}) {
  const price =
    billingInterval === 'monthly'
      ? plan.priceMonthly
      : Math.round(plan.priceYearly / 12);

  return (
    <Card
      className={cn(
        'relative',
        plan.popular && 'border-primary ring-1 ring-primary'
      )}
    >
      {plan.popular && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
          <Badge>Most Popular</Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className='pt-4'>
          {plan.id === 'ENTERPRISE' ? (
            <p className='text-3xl font-bold'>Contact Us</p>
          ) : (
            <>
              <p className='text-3xl font-bold'>
                ${price}
                <span className='text-base font-normal text-muted-foreground'>
                  /month
                </span>
              </p>
              {billingInterval === 'yearly' && plan.priceYearly > 0 && (
                <p className='text-sm text-muted-foreground'>
                  Billed ${plan.priceYearly}/year
                </p>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <ul className='space-y-2'>
          {plan.features.map((feature, index) => (
            <li key={index} className='flex items-start gap-2 text-sm'>
              <CheckIcon className='mt-0.5 h-4 w-4 flex-shrink-0 text-green-500' />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className='w-full'
          variant={plan.popular ? 'default' : 'outline'}
          disabled={isCurrentPlan}
          onClick={onSelect}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  return (
    <div className='flex items-center justify-between rounded-lg border p-4'>
      <div className='flex items-center gap-4'>
        <CreditCard className='h-8 w-8 text-muted-foreground' />
        <div>
          <p className='font-medium'>
            {method.brand} •••• {method.last4}
          </p>
          <p className='text-sm text-muted-foreground'>
            Expires {method.expiryMonth}/{method.expiryYear}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        {method.isDefault && <Badge variant='secondary'>Default</Badge>}
        <Button variant='ghost' size='sm'>
          Edit
        </Button>
      </div>
    </div>
  );
}

function BudgetAlertCard({ alert }: { alert: BudgetAlert }) {
  return (
    <div className='flex items-center justify-between rounded-lg border p-4'>
      <div className='flex-1'>
        <p className='font-medium'>Alert at ${alert.threshold}</p>
        <p className='text-sm text-muted-foreground'>
          Notify via:{' '}
          {[alert.notifyEmail && 'Email', alert.notifySlack && 'Slack']
            .filter(Boolean)
            .join(', ') || 'None'}
        </p>
      </div>
      <Switch checked={alert.enabled} />
    </div>
  );
}

function UpgradeModal({
  plan,
  billingInterval,
  isUpgrading,
  onConfirm,
  onClose,
}: {
  plan: Plan;
  billingInterval: BillingInterval;
  isUpgrading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const price =
    billingInterval === 'monthly' ? plan.priceMonthly : plan.priceYearly;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to {plan.name}</DialogTitle>
          <DialogDescription>
            You will be charged ${price}{' '}
            {billingInterval === 'monthly' ? 'per month' : 'per year'}.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='rounded-lg bg-muted p-4'>
            <h4 className='font-medium'>What&apos;s included:</h4>
            <ul className='mt-2 space-y-1'>
              {plan.features.slice(0, 5).map((feature, index) => (
                <li key={index} className='text-sm text-muted-foreground'>
                  • {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isUpgrading}>
            {isUpgrading ? 'Processing...' : 'Confirm Upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMethodDialog({
  open,
  onClose,
  onSuccess,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceSlug: string;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleAddPaymentMethod = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/billing/payment-methods/setup-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to initiate payment setup');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback: reload billing data in case the method was already added
        void onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to add payment method:', error);
      toast.error('Failed to initiate payment setup. Please try again.');
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            You will be redirected to our secure payment provider to add a
            credit or debit card.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='flex items-start gap-3 rounded-lg border bg-muted/50 p-4'>
            <CreditCard className='mt-0.5 h-5 w-5 shrink-0 text-muted-foreground' />
            <div className='space-y-1'>
              <p className='text-sm font-medium'>Secure Payment Processing</p>
              <p className='text-xs text-muted-foreground'>
                Your card details are handled securely by Stripe and are never
                stored on our servers. You will be redirected to a secure
                checkout page to complete the setup.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isRedirecting}>
            Cancel
          </Button>
          <Button onClick={handleAddPaymentMethod} disabled={isRedirecting}>
            <CreditCard className='mr-2 h-4 w-4' />
            {isRedirecting ? 'Redirecting...' : 'Continue to Secure Checkout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnterpriseContactDialog({
  open,
  onClose,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    employees: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    setIsSending(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/billing/contact-enterprise`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to send request');
      }

      toast.success(
        'Thank you! Our enterprise team will contact you within 24 hours.'
      );
      onClose();
    } catch (error) {
      console.error('Failed to send request:', error);
      toast.error('Failed to send request. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Contact Enterprise Sales</DialogTitle>
          <DialogDescription>
            Get in touch with our team to discuss enterprise plans and pricing
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={formData.name}
                onChange={e =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={formData.email}
                onChange={e =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='company'>Company</Label>
              <Input
                id='company'
                value={formData.company}
                onChange={e =>
                  setFormData({ ...formData, company: e.target.value })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='employees'>Number of Employees</Label>
              <Select
                value={formData.employees}
                onValueChange={value =>
                  setFormData({ ...formData, employees: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='50-200'>50-200</SelectItem>
                  <SelectItem value='200-500'>200-500</SelectItem>
                  <SelectItem value='500-1000'>500-1000</SelectItem>
                  <SelectItem value='1000+'>1000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='message'>Message</Label>
            <Textarea
              id='message'
              rows={4}
              placeholder='Tell us about your requirements...'
              value={formData.message}
              onChange={e =>
                setFormData({ ...formData, message: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSending}>
            <Mail className='mr-2 h-4 w-4' />
            {isSending ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetAlertDialog({
  open,
  onClose,
  onSuccess,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workspaceSlug: string;
}) {
  const [threshold, setThreshold] = useState('100');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySlack, setNotifySlack] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceSlug}/admin/billing/budget-alerts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threshold: parseFloat(threshold),
            notifyEmail,
            notifySlack,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to create alert');
      }

      toast.success('Budget alert created');
      onClose();
      void onSuccess();
    } catch (error) {
      console.error('Failed to create alert:', error);
      toast.error('Failed to create alert. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Budget Alert</DialogTitle>
          <DialogDescription>
            Get notified when your spending reaches a certain threshold
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='threshold'>Alert Threshold ($)</Label>
            <Input
              id='threshold'
              type='number'
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label>Notification Channels</Label>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='email' className='cursor-pointer'>
                  Email notifications
                </Label>
                <Switch
                  id='email'
                  checked={notifyEmail}
                  onCheckedChange={setNotifyEmail}
                />
              </div>
              <div className='flex items-center justify-between'>
                <Label htmlFor='slack' className='cursor-pointer'>
                  Slack notifications
                </Label>
                <Switch
                  id='slack'
                  checked={notifySlack}
                  onCheckedChange={setNotifySlack}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingPageSkeleton() {
  return (
    <div className='space-y-8'>
      <div className='h-64 animate-pulse rounded-lg bg-muted' />
      <div className='grid gap-4 md:grid-cols-3'>
        <div className='h-32 animate-pulse rounded-lg bg-muted' />
        <div className='h-32 animate-pulse rounded-lg bg-muted' />
        <div className='h-32 animate-pulse rounded-lg bg-muted' />
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
