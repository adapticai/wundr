'use client';

import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    seats: number;
    storage: number;
    vps: number;
    integrations: number;
  };
}

export interface BillingUsage {
  seats: { used: number; limit: number };
  storage: { used: number; limit: number; unit: string };
  vps: { used: number; limit: number };
  integrations: { used: number; limit: number };
}

export interface BillingHistory {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl?: string;
}

/**
 * Props for the BillingOverview component.
 */
export interface BillingOverviewProps {
  /** The workspace ID to fetch billing data for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

const AVAILABLE_PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'monthly',
    features: ['Up to 5 members', '1 GB storage', '1 Virtual Persona', 'Basic integrations'],
    limits: { seats: 5, storage: 1, vps: 1, integrations: 2 },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    interval: 'monthly',
    features: ['Up to 50 members', '50 GB storage', '10 Virtual Personas', 'Advanced integrations', 'Priority support'],
    limits: { seats: 50, storage: 50, vps: 10, integrations: 10 },
  },
  {
    id: 'business',
    name: 'Business',
    price: 30,
    interval: 'monthly',
    features: ['Unlimited members', '500 GB storage', 'Unlimited Virtual Personas', 'All integrations', 'SSO', '24/7 support'],
    limits: { seats: -1, storage: 500, vps: -1, integrations: -1 },
  },
];

export function BillingOverview({ workspaceId, className }: BillingOverviewProps) {
  const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [history, setHistory] = useState<BillingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlanComparison, setShowPlanComparison] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const fetchBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [planRes, usageRes, historyRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/admin/billing/plan`),
        fetch(`/api/workspaces/${workspaceId}/admin/billing/usage`),
        fetch(`/api/workspaces/${workspaceId}/admin/billing/history`),
      ]);

      if (planRes.ok) {
        const data = await planRes.json();
        setCurrentPlan(data.plan || AVAILABLE_PLANS[0]);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.invoices || []);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/admin/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          fetchBillingData();
        }
      }
    } catch {
      // Handle error
    } finally {
      setIsUpgrading(false);
    }
  };

  const formatStorage = (gb: number) => {
    if (gb < 1) {
return `${Math.round(gb * 1024)} MB`;
}
    return `${gb} GB`;
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardDescription>Current Plan</CardDescription>
              <CardTitle className="mt-1">
                {currentPlan?.name || 'Free'}
              </CardTitle>
              {currentPlan && currentPlan.price > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  ${currentPlan.price}/member/{currentPlan.interval}
                </p>
              )}
            </div>
            <Button onClick={() => setShowPlanComparison(true)}>
              Upgrade Plan
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Usage meters */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UsageMeter
            label="Seats"
            used={usage.seats.used}
            limit={usage.seats.limit}
            formatValue={(v) => v.toString()}
          />
          <UsageMeter
            label="Storage"
            used={usage.storage.used}
            limit={usage.storage.limit}
            formatValue={formatStorage}
          />
          <UsageMeter
            label="Virtual Personas"
            used={usage.vps.used}
            limit={usage.vps.limit}
            formatValue={(v) => v.toString()}
          />
          <UsageMeter
            label="Integrations"
            used={usage.integrations.used}
            limit={usage.integrations.limit}
            formatValue={(v) => v.toString()}
          />
        </div>
      )}

      {/* Billing history */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Billing History</h3>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No billing history
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      ${item.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded capitalize',
                          item.status === 'paid'
                            ? 'bg-green-500/10 text-green-500'
                            : item.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-red-500/10 text-red-500',
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.invoiceUrl && (
                        <a
                          href={item.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan comparison modal */}
      <Dialog open={showPlanComparison} onOpenChange={setShowPlanComparison}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Compare Plans</DialogTitle>
          </DialogHeader>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {AVAILABLE_PLANS.map((plan) => {
                  const isCurrent = currentPlan?.id === plan.id;

                  return (
                    <Card
                      key={plan.id}
                      className={cn(
                        isCurrent && 'border-primary bg-primary/5',
                      )}
                    >
                      <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-foreground">
                            ${plan.price}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-muted-foreground">
                              /member/mo
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {plan.features.map((feature, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <CheckIcon className="h-4 w-4 text-primary" />
                              {feature}
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="w-full mt-4"
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isCurrent || isUpgrading}
                          variant={isCurrent ? 'secondary' : 'default'}
                        >
                          {isCurrent
                            ? 'Current Plan'
                            : plan.price > (currentPlan?.price || 0)
                            ? 'Upgrade'
                            : 'Downgrade'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  formatValue,
}: {
  label: string;
  used: number;
  limit: number;
  formatValue: (value: number) => string;
}) {
  const percentage = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);
  const isUnlimited = limit === -1;

  return (
    <Card>
      <CardContent className="pt-6">
        <CardDescription>{label}</CardDescription>
        <p className="text-2xl font-semibold text-foreground mt-1">
          {formatValue(used)}
          <span className="text-sm text-muted-foreground font-normal">
            {' / '}
            {isUnlimited ? 'Unlimited' : formatValue(limit)}
          </span>
        </p>
        {!isUnlimited && (
          <Progress value={percentage} className="mt-2" />
        )}
      </CardContent>
    </Card>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default BillingOverview;
