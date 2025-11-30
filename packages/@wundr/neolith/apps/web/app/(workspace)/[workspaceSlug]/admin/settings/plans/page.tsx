'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Users,
  Database,
  Zap,
  Check,
  ArrowUpCircle,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    members: number;
    storage: number; // in GB
    apiCalls: number;
  };
}

interface CurrentPlan {
  plan: Plan;
  billingCycle: {
    start: string;
    end: string;
    nextBillingDate: string;
  };
  usage: {
    members: number;
    storage: number; // in GB
    apiCalls: number;
  };
}

const AVAILABLE_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: ['Up to 5 members', '5GB storage', '1,000 API calls/month', 'Basic support'],
    limits: { members: 5, storage: 5, apiCalls: 1000 },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    interval: 'month',
    features: ['Up to 50 members', '100GB storage', '50,000 API calls/month', 'Priority support', 'Advanced analytics'],
    limits: { members: 50, storage: 100, apiCalls: 50000 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    features: ['Unlimited members', '1TB storage', 'Unlimited API calls', '24/7 support', 'Custom integrations', 'SLA guarantee'],
    limits: { members: -1, storage: 1000, apiCalls: -1 },
  },
];

/**
 * Plans & Usage Admin Settings Page
 *
 * Displays billing plans and usage metrics:
 * - Current plan details (name, price, features)
 * - Usage metrics (members, storage, API calls)
 * - Plan comparison with upgrade options
 * - Billing cycle information
 */
export default function PlansUsagePage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Load current plan and usage
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceSlug}/billing/plan`);
        if (!response.ok) throw new Error('Failed to load plan data');
        const data = await response.json();
        setCurrentPlan(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load plan data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPlanData();
  }, [workspaceSlug, toast]);

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade plan');
      }

      const data = await response.json();
      setCurrentPlan(data);

      toast({
        title: 'Success',
        description: 'Plan upgraded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upgrade plan',
        variant: 'destructive',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const plan = currentPlan?.plan || AVAILABLE_PLANS[0];
  const usage = currentPlan?.usage || { members: 0, storage: 0, apiCalls: 0 };
  const billingCycle = currentPlan?.billingCycle;

  const memberUsagePercent = plan.limits.members > 0
    ? (usage.members / plan.limits.members) * 100
    : 0;
  const storageUsagePercent = plan.limits.storage > 0
    ? (usage.storage / plan.limits.storage) * 100
    : 0;
  const apiCallsUsagePercent = plan.limits.apiCalls > 0
    ? (usage.apiCalls / plan.limits.apiCalls) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plans & Usage</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your workspace plan and monitor usage
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your active subscription and billing details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                {plan.price === 0 ? (
                  <Badge variant="secondary">Free</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </div>
              <p className="text-3xl font-bold text-primary">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
              </p>
            </div>
            {plan.id !== 'enterprise' && (
              <Button onClick={() => handleUpgrade('enterprise')} disabled={isUpgrading}>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Plan Features</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {billingCycle && (
            <div className="flex items-center gap-4 border-t pt-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Billing Cycle: {new Date(billingCycle.start).toLocaleDateString()} - {new Date(billingCycle.end).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Next billing: {new Date(billingCycle.nextBillingDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Metrics
          </CardTitle>
          <CardDescription>
            Current usage for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Members Usage */}
          <UsageBar
            label="Members"
            icon={<Users className="h-4 w-4" />}
            current={usage.members}
            limit={plan.limits.members}
            percentage={memberUsagePercent}
            unit="members"
          />

          {/* Storage Usage */}
          <UsageBar
            label="Storage"
            icon={<Database className="h-4 w-4" />}
            current={usage.storage}
            limit={plan.limits.storage}
            percentage={storageUsagePercent}
            unit="GB"
          />

          {/* API Calls Usage */}
          <UsageBar
            label="API Calls"
            icon={<Zap className="h-4 w-4" />}
            current={usage.apiCalls}
            limit={plan.limits.apiCalls}
            percentage={apiCallsUsagePercent}
            unit="calls"
          />
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare plans and find the right fit for your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {AVAILABLE_PLANS.map((availablePlan) => (
              <PlanCard
                key={availablePlan.id}
                plan={availablePlan}
                isCurrentPlan={plan.id === availablePlan.id}
                onUpgrade={handleUpgrade}
                isUpgrading={isUpgrading}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageBar({
  label,
  icon,
  current,
  limit,
  percentage,
  unit,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  percentage: number;
  unit: string;
}) {
  const isUnlimited = limit < 0;
  const nearLimit = percentage > 80 && !isUnlimited;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {current.toLocaleString()} {isUnlimited ? unit : `/ ${limit.toLocaleString()} ${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all',
                nearLimit ? 'bg-yellow-500' : 'bg-primary',
                percentage >= 100 && 'bg-red-500',
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          {nearLimit && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              {percentage >= 100 ? 'Limit reached' : 'Approaching limit'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrentPlan,
  onUpgrade,
  isUpgrading,
}: {
  plan: Plan;
  isCurrentPlan: boolean;
  onUpgrade: (planId: string) => void;
  isUpgrading: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        isCurrentPlan && 'border-primary bg-primary/5',
      )}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="text-2xl font-bold mt-2">
            ${plan.price}
            <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          {plan.features.slice(0, 3).map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {isCurrentPlan ? (
          <Badge variant="secondary" className="w-full justify-center">
            Current Plan
          </Badge>
        ) : (
          <Button
            onClick={() => onUpgrade(plan.id)}
            disabled={isUpgrading}
            variant={plan.id === 'enterprise' ? 'default' : 'outline'}
            className="w-full"
          >
            {plan.price > 0 ? 'Upgrade' : 'Downgrade'}
          </Button>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
