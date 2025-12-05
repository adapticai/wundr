'use client';

/**
 * Hook for managing workspace admin billing information
 * @module hooks/admin/use-admin-billing
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';

import type { AdminBillingInfo, AvailablePlan, PlanType } from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * Plan change options
 */
export interface PlanChangeOptions {
  /** Target plan type */
  plan: PlanType;
  /** Billing interval */
  interval?: 'monthly' | 'annual';
  /** Whether to prorate */
  prorate?: boolean;
}

/**
 * Return type for useAdminBilling hook
 */
export interface UseAdminBillingReturn {
  /** Current billing information */
  billing: AdminBillingInfo | null;
  /** Available plans for upgrade/downgrade */
  availablePlans: AvailablePlan[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Change subscription plan */
  changePlan: (options: PlanChangeOptions) => Promise<void>;
  /** Cancel subscription */
  cancelSubscription: () => Promise<void>;
  /** Reactivate cancelled subscription */
  reactivateSubscription: () => Promise<void>;
  /** Update payment method */
  updatePaymentMethod: (paymentMethodId: string) => Promise<void>;
  /** Preview plan change */
  previewPlanChange: (options: PlanChangeOptions) => Promise<{
    prorationAmount: number;
    nextInvoiceAmount: number;
    effectiveDate: Date;
  }>;
  /** Manually refresh billing data */
  refresh: () => Promise<void>;
  /** Whether any action is in progress */
  isUpdating: boolean;
}

// =============================================================================
// Fetchers
// =============================================================================

/**
 * Fetcher for billing information
 */
const billingFetcher = async (url: string): Promise<AdminBillingInfo> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        errorData.message ||
        'Failed to fetch billing information'
    );
  }

  const result = await res.json();
  const data = result.data || result;

  // Transform date strings
  return {
    ...data,
    currentPeriodStart: new Date(data.currentPeriodStart),
    currentPeriodEnd: new Date(data.currentPeriodEnd),
    trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
    nextInvoiceDate: data.nextInvoiceDate
      ? new Date(data.nextInvoiceDate)
      : undefined,
  } as AdminBillingInfo;
};

/**
 * Fetcher for available plans
 */
const plansFetcher = async (url: string): Promise<AvailablePlan[]> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message || 'Failed to fetch plans'
    );
  }

  const result = await res.json();
  return (result.data || result.plans || []) as AvailablePlan[];
};

// =============================================================================
// Hook: useAdminBilling
// =============================================================================

/**
 * Hook for managing workspace admin billing information
 *
 * Provides comprehensive billing management including plan changes,
 * subscription management, and usage monitoring.
 *
 * @param workspaceId - The workspace ID
 * @returns Billing information and management functions
 *
 * @example
 * ```tsx
 * function BillingPage() {
 *   const {
 *     billing,
 *     availablePlans,
 *     isLoading,
 *     changePlan,
 *     cancelSubscription,
 *     previewPlanChange,
 *   } = useAdminBilling('workspace-123');
 *
 *   const handleUpgrade = async (plan: PlanType) => {
 *     // Preview the change
 *     const preview = await previewPlanChange({
 *       plan,
 *       interval: 'monthly',
 *     });
 *
 *     // Confirm with user
 *     if (confirm(`New charge: $${preview.nextInvoiceAmount / 100}`)) {
 *       await changePlan({ plan, interval: 'monthly' });
 *       toast.success('Plan upgraded successfully');
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <CurrentPlan billing={billing} />
 *       <UsageMetrics usage={billing?.usage} />
 *       <PlanSelector
 *         plans={availablePlans}
 *         currentPlan={billing?.plan}
 *         onSelect={handleUpgrade}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminBilling(workspaceId: string): UseAdminBillingReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const billingUrl = `/api/workspaces/${workspaceId}/admin/billing`;
  const plansUrl = `/api/workspaces/${workspaceId}/admin/billing/plans`;

  // Fetch billing info
  const {
    data: billing,
    error: billingError,
    isLoading: billingLoading,
    mutate: mutateBilling,
  } = useSWR<AdminBillingInfo>(billingUrl, billingFetcher, {
    revalidateOnFocus: false,
  });

  // Fetch available plans
  const {
    data: availablePlans = [],
    error: plansError,
    isLoading: plansLoading,
  } = useSWR<AvailablePlan[]>(plansUrl, plansFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // Cache for 5 minutes
  });

  const isLoading = billingLoading || plansLoading;
  const error = billingError || plansError;

  // Manual refresh
  const refresh = useCallback(async () => {
    await mutateBilling();
  }, [mutateBilling]);

  // Change plan
  const changePlan = useCallback(
    async (options: PlanChangeOptions) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`${billingUrl}/plan`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || 'Failed to change plan'
          );
        }

        await mutateBilling();
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to change plan');
      } finally {
        setIsUpdating(false);
      }
    },
    [billingUrl, mutateBilling]
  );

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    try {
      setIsUpdating(true);

      const res = await fetch(`${billingUrl}/subscription/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            'Failed to cancel subscription'
        );
      }

      await mutateBilling();
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Failed to cancel subscription');
    } finally {
      setIsUpdating(false);
    }
  }, [billingUrl, mutateBilling]);

  // Reactivate subscription
  const reactivateSubscription = useCallback(async () => {
    try {
      setIsUpdating(true);

      const res = await fetch(`${billingUrl}/subscription/reactivate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            'Failed to reactivate subscription'
        );
      }

      await mutateBilling();
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Failed to reactivate subscription');
    } finally {
      setIsUpdating(false);
    }
  }, [billingUrl, mutateBilling]);

  // Update payment method
  const updatePaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      try {
        setIsUpdating(true);

        const res = await fetch(`${billingUrl}/payment-method`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              'Failed to update payment method'
          );
        }

        await mutateBilling();
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error('Failed to update payment method');
      } finally {
        setIsUpdating(false);
      }
    },
    [billingUrl, mutateBilling]
  );

  // Preview plan change
  const previewPlanChange = useCallback(
    async (options: PlanChangeOptions) => {
      const res = await fetch(`${billingUrl}/plan/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            'Failed to preview plan change'
        );
      }

      const result = await res.json();
      const data = result.data || result;

      return {
        prorationAmount: data.prorationAmount,
        nextInvoiceAmount: data.nextInvoiceAmount,
        effectiveDate: new Date(data.effectiveDate),
      };
    },
    [billingUrl]
  );

  return {
    billing: billing ?? null,
    availablePlans,
    isLoading,
    error: error as Error | null,
    changePlan,
    cancelSubscription,
    reactivateSubscription,
    updatePaymentMethod,
    previewPlanChange,
    refresh,
    isUpdating,
  };
}
