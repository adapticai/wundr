'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';

import { useBilling } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

type BillingInterval = 'monthly' | 'yearly';

/**
 * Billing Overview Page
 *
 * Features billing information, plan comparison, and upgrade flow
 */
export default function AdminBillingPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Billing & Plans',
      'Manage your subscription and billing information'
    );
  }, [setPageHeader]);

  const { billing, isLoading, updatePlan } = useBilling(workspaceSlug);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = useCallback(
    async (planId: string) => {
      setIsUpgrading(true);
      try {
        // Cast planId to the expected BillingPlan type
        await updatePlan(planId as 'free' | 'starter' | 'pro' | 'enterprise');
        setSelectedPlan(null);
      } finally {
        setIsUpgrading(false);
      }
    },
    [updatePlan]
  );

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'For small teams getting started',
      priceMonthly: 0,
      priceYearly: 0,
      features: [
        'Up to 5 members',
        '10 GB storage',
        '30-day message history',
        'Basic integrations',
        'Community support',
      ],
      limits: {
        members: 5,
        storage: '10 GB',
        messageHistory: '30 days',
      },
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For growing teams that need more',
      priceMonthly: 15,
      priceYearly: 144,
      popular: true,
      features: [
        'Up to 50 members',
        '100 GB storage',
        'Unlimited message history',
        'Advanced integrations',
        'Priority support',
        'Custom roles',
        'SSO authentication',
      ],
      limits: {
        members: 50,
        storage: '100 GB',
        messageHistory: 'Unlimited',
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations with advanced needs',
      priceMonthly: 30,
      priceYearly: 288,
      features: [
        'Unlimited members',
        '1 TB storage',
        'Unlimited message history',
        'All integrations',
        'Dedicated support',
        'Custom roles',
        'SSO & SCIM',
        'Advanced analytics',
        'Data export',
        'SLA guarantee',
      ],
      limits: {
        members: 'Unlimited',
        storage: '1 TB',
        messageHistory: 'Unlimited',
      },
    },
  ];

  const currentPlan = plans.find(p => p.id === billing?.plan) || plans[0];

  return (
    <div className='space-y-8'>
      {/* Current Plan Overview */}
      {isLoading ? (
        <BillingOverviewSkeleton />
      ) : (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='font-semibold text-foreground'>Current Plan</h2>
          </div>
          <div className='p-6'>
            <div className='flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
              <div>
                <div className='flex items-center gap-3'>
                  <h3 className='text-2xl font-bold text-foreground'>
                    {currentPlan.name}
                  </h3>
                  {currentPlan.id !== 'free' && (
                    <span className='rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
                      Active
                    </span>
                  )}
                </div>
                <p className='mt-1 text-muted-foreground'>
                  {currentPlan.description}
                </p>

                {billing?.currentPeriodEnd && (
                  <p className='mt-4 text-sm text-muted-foreground'>
                    {billing.status === 'canceled'
                      ? `Subscription ends on ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                      : `Next billing date: ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                )}
              </div>

              <div className='flex flex-col items-end'>
                <p className='text-3xl font-bold text-foreground'>
                  $
                  {billingInterval === 'monthly'
                    ? currentPlan.priceMonthly
                    : Math.round(currentPlan.priceYearly / 12)}
                  <span className='text-base font-normal text-muted-foreground'>
                    /month
                  </span>
                </p>
                {currentPlan.id !== 'free' && (
                  <button
                    type='button'
                    className='mt-2 text-sm text-muted-foreground hover:text-foreground'
                  >
                    Manage subscription
                  </button>
                )}
              </div>
            </div>

            {/* Usage Stats */}
            <div className='mt-6 grid gap-4 sm:grid-cols-3'>
              <UsageCard
                label='Members'
                current={billing?.memberLimit ?? 0}
                limit={currentPlan.limits.members}
              />
              <UsageCard
                label='Storage'
                current={formatStorage(billing?.storageUsed ?? 0)}
                limit={currentPlan.limits.storage}
              />
              <UsageCard
                label='Message History'
                current='Active'
                limit={currentPlan.limits.messageHistory}
              />
            </div>
          </div>
        </div>
      )}

      {/* Billing Interval Toggle */}
      <div className='flex items-center justify-center gap-4'>
        <button
          type='button'
          onClick={() => setBillingInterval('monthly')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium',
            billingInterval === 'monthly'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Monthly
        </button>
        <button
          type='button'
          onClick={() => setBillingInterval('yearly')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium',
            billingInterval === 'yearly'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Yearly
          <span className='ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300'>
            Save 20%
          </span>
        </button>
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

      {/* Payment Method */}
      {billing?.status === 'active' && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='font-semibold text-foreground'>Payment Method</h2>
          </div>
          <div className='flex items-center justify-between p-6'>
            <div className='flex items-center gap-4'>
              <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-stone'>
                <CreditCardIcon className='h-6 w-6 text-muted-foreground' />
              </div>
              <div>
                <p className='font-medium text-foreground'>
                  Payment method on file
                </p>
                <p className='text-sm text-muted-foreground'>
                  Contact support to update
                </p>
              </div>
            </div>
            <button
              type='button'
              className='rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted'
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Billing History */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='font-semibold text-foreground'>Billing History</h2>
        </div>
        <div className='divide-y'>
          {billing?.invoices && billing.invoices.length > 0 ? (
            billing.invoices.map(invoice => (
              <div
                key={invoice.id}
                className='flex items-center justify-between px-6 py-4'
              >
                <div>
                  <p className='font-medium text-foreground'>
                    {new Date(invoice.date).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    Invoice #{invoice.id}
                  </p>
                </div>
                <div className='flex items-center gap-4'>
                  <span className='font-medium text-foreground'>
                    ${(invoice.amount / 100).toFixed(2)} {invoice.currency}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      invoice.status === 'paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    )}
                  >
                    {invoice.status}
                  </span>
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      className='text-sm text-primary hover:underline'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className='px-6 py-8 text-center text-muted-foreground'>
              No billing history available
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}

// Types
interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  popular?: boolean;
  features: string[];
  limits: {
    members: number | string;
    storage: string;
    messageHistory: string;
  };
}

// Usage Card Component
function UsageCard({
  label,
  current,
  limit,
}: {
  label: string;
  current: number | string;
  limit: number | string;
}) {
  const percentage =
    typeof current === 'number' && typeof limit === 'number'
      ? Math.min((current / limit) * 100, 100)
      : null;

  return (
    <div className='rounded-lg border bg-muted/30 p-4'>
      <p className='text-sm text-muted-foreground'>{label}</p>
      <p className='mt-1 text-lg font-semibold text-foreground'>
        {current}
        {typeof limit === 'number' && (
          <span className='text-muted-foreground'> / {limit}</span>
        )}
      </p>
      {percentage !== null && (
        <div className='mt-2 h-2 overflow-hidden rounded-full bg-muted'>
          <div
            className={cn(
              'h-full rounded-full',
              percentage > 90
                ? 'bg-red-500'
                : percentage > 70
                  ? 'bg-yellow-500'
                  : 'bg-primary'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Plan Card Component
interface PlanCardProps {
  plan: Plan;
  billingInterval: BillingInterval;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

function PlanCard({
  plan,
  billingInterval,
  isCurrentPlan,
  onSelect,
}: PlanCardProps) {
  const price =
    billingInterval === 'monthly'
      ? plan.priceMonthly
      : Math.round(plan.priceYearly / 12);

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card p-6',
        plan.popular && 'border-primary ring-1 ring-primary'
      )}
    >
      {plan.popular && (
        <span className='absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>
          Most Popular
        </span>
      )}

      <div className='text-center'>
        <h3 className='text-lg font-semibold text-foreground'>{plan.name}</h3>
        <p className='mt-1 text-sm text-muted-foreground'>{plan.description}</p>

        <div className='mt-4'>
          <span className='text-4xl font-bold text-foreground'>${price}</span>
          <span className='text-muted-foreground'>/month</span>
        </div>

        {billingInterval === 'yearly' && plan.priceYearly > 0 && (
          <p className='mt-1 text-sm text-muted-foreground'>
            Billed ${plan.priceYearly}/year
          </p>
        )}
      </div>

      <ul className='mt-6 space-y-3'>
        {plan.features.map(feature => (
          <li key={feature} className='flex items-start gap-2'>
            <CheckIcon className='mt-0.5 h-4 w-4 flex-shrink-0 text-green-500' />
            <span className='text-sm text-muted-foreground'>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type='button'
        onClick={onSelect}
        disabled={isCurrentPlan}
        className={cn(
          'mt-6 w-full rounded-md px-4 py-2 text-sm font-medium',
          isCurrentPlan
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : plan.popular
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-input hover:bg-muted'
        )}
      >
        {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
      </button>
    </div>
  );
}

// Upgrade Modal Component
interface UpgradeModalProps {
  plan: Plan;
  billingInterval: BillingInterval;
  isUpgrading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function UpgradeModal({
  plan,
  billingInterval,
  isUpgrading,
  onConfirm,
  onClose,
}: UpgradeModalProps) {
  const price =
    billingInterval === 'monthly' ? plan.priceMonthly : plan.priceYearly;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='w-full max-w-md rounded-lg bg-card p-6 shadow-xl'>
        <h2 className='text-lg font-semibold text-foreground'>
          Upgrade to {plan.name}
        </h2>
        <p className='mt-2 text-muted-foreground'>
          You will be charged ${price}{' '}
          {billingInterval === 'monthly' ? 'per month' : 'per year'}.
        </p>

        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={isUpgrading}
            className={cn(
              'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
              'hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isUpgrading ? 'Processing...' : 'Confirm Upgrade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Billing Overview Skeleton
function BillingOverviewSkeleton() {
  return (
    <div className='rounded-lg border bg-card'>
      <div className='border-b px-6 py-4'>
        <div className='h-5 w-32 animate-pulse rounded bg-muted' />
      </div>
      <div className='p-6'>
        <div className='flex justify-between'>
          <div className='space-y-2'>
            <div className='h-8 w-24 animate-pulse rounded bg-muted' />
            <div className='h-4 w-48 animate-pulse rounded bg-muted' />
          </div>
          <div className='h-10 w-24 animate-pulse rounded bg-muted' />
        </div>
        <div className='mt-6 grid gap-4 sm:grid-cols-3'>
          {[1, 2, 3].map(i => (
            <div key={i} className='h-24 animate-pulse rounded-lg bg-muted' />
          ))}
        </div>
      </div>
    </div>
  );
}

// Utility Functions
function formatStorage(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Icons
function CreditCardIcon({ className }: { className?: string }) {
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
      <rect width='20' height='14' x='2' y='5' rx='2' />
      <line x1='2' x2='22' y1='10' y2='10' />
    </svg>
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
