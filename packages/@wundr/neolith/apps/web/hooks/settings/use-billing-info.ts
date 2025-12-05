'use client';

/**
 * @neolith/hooks/settings/use-billing-info
 *
 * Hook for fetching and managing billing information including
 * subscription status, payment methods, and invoices.
 *
 * @module hooks/settings/use-billing-info
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Subscription plan type
 */
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';

/**
 * Payment method type
 */
export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'paypal';
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

/**
 * Invoice information
 */
export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  dueDate: Date;
  paidAt: Date | null;
  invoiceUrl: string;
}

/**
 * Subscription information
 */
export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

/**
 * Billing information state
 */
export interface BillingInfo {
  subscription: SubscriptionInfo;
  paymentMethods: PaymentMethod[];
  invoices: Invoice[];
  upcomingInvoice: Invoice | null;
  billingEmail: string;
}

/**
 * Return type for useBillingInfo hook
 */
export interface UseBillingInfoReturn {
  /** Current billing information */
  billing: BillingInfo | null;
  /** Whether billing info is loading */
  isLoading: boolean;
  /** Error loading billing info */
  error: Error | null;
  /** Refresh billing information */
  refresh: () => Promise<void>;
  /** Add a payment method */
  addPaymentMethod: (token: string) => Promise<void>;
  /** Remove a payment method */
  removePaymentMethod: (methodId: string) => Promise<void>;
  /** Set default payment method */
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  /** Update subscription plan */
  updateSubscription: (plan: SubscriptionPlan) => Promise<void>;
  /** Cancel subscription */
  cancelSubscription: () => Promise<void>;
  /** Reactivate subscription */
  reactivateSubscription: () => Promise<void>;
  /** Download invoice */
  downloadInvoice: (invoiceId: string) => Promise<void>;
  /** Whether any action is in progress */
  isUpdating: boolean;
}

/**
 * Hook for managing billing information
 *
 * Provides comprehensive billing controls including subscription management,
 * payment methods, and invoice access.
 *
 * @returns Billing information and management methods
 *
 * @example
 * ```tsx
 * function BillingPage() {
 *   const {
 *     billing,
 *     isLoading,
 *     updateSubscription,
 *     addPaymentMethod,
 *     downloadInvoice,
 *   } = useBillingInfo();
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <div>
 *       <h2>Current Plan: {billing?.subscription.plan}</h2>
 *       <p>Status: {billing?.subscription.status}</p>
 *       <Button onClick={() => updateSubscription('pro')}>
 *         Upgrade to Pro
 *       </Button>
 *
 *       <h3>Payment Methods</h3>
 *       {billing?.paymentMethods.map((method) => (
 *         <div key={method.id}>
 *           {method.brand} ending in {method.last4}
 *           {method.isDefault && <Badge>Default</Badge>}
 *         </div>
 *       ))}
 *
 *       <h3>Invoices</h3>
 *       {billing?.invoices.map((invoice) => (
 *         <div key={invoice.id}>
 *           {invoice.number} - ${invoice.amount}
 *           <Button onClick={() => downloadInvoice(invoice.id)}>
 *             Download
 *           </Button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBillingInfo(): UseBillingInfoReturn {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch billing information
  const fetchBilling = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/billing');

      if (!response.ok) {
        throw new Error('Failed to fetch billing information');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch billing information');
      }

      // Transform API response to BillingInfo
      const data = result.data;
      setBilling({
        subscription: {
          plan: data.subscription?.plan ?? 'free',
          status: data.subscription?.status ?? 'active',
          currentPeriodStart: new Date(data.subscription?.currentPeriodStart),
          currentPeriodEnd: new Date(data.subscription?.currentPeriodEnd),
          cancelAtPeriodEnd: data.subscription?.cancelAtPeriodEnd ?? false,
          trialEnd: data.subscription?.trialEnd
            ? new Date(data.subscription.trialEnd)
            : null,
        },
        paymentMethods: (data.paymentMethods || []).map((pm: unknown) => ({
          id: (pm as { id: string }).id,
          type: (pm as { type: string }).type,
          last4: (pm as { last4: string }).last4,
          brand: (pm as { brand: string }).brand,
          expiryMonth: (pm as { expiryMonth: number }).expiryMonth,
          expiryYear: (pm as { expiryYear: number }).expiryYear,
          isDefault: (pm as { isDefault: boolean }).isDefault ?? false,
        })),
        invoices: (data.invoices || []).map((inv: unknown) => ({
          id: (inv as { id: string }).id,
          number: (inv as { number: string }).number,
          amount: (inv as { amount: number }).amount,
          currency: (inv as { currency: string }).currency || 'USD',
          status: (inv as { status: string }).status,
          dueDate: new Date((inv as { dueDate: string }).dueDate),
          paidAt: (inv as { paidAt: string | null }).paidAt
            ? new Date((inv as { paidAt: string }).paidAt)
            : null,
          invoiceUrl: (inv as { invoiceUrl: string }).invoiceUrl,
        })),
        upcomingInvoice: data.upcomingInvoice
          ? {
              id: data.upcomingInvoice.id,
              number: data.upcomingInvoice.number,
              amount: data.upcomingInvoice.amount,
              currency: data.upcomingInvoice.currency || 'USD',
              status: data.upcomingInvoice.status,
              dueDate: new Date(data.upcomingInvoice.dueDate),
              paidAt: null,
              invoiceUrl: data.upcomingInvoice.invoiceUrl,
            }
          : null,
        billingEmail: data.billingEmail || '',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchBilling();
  }, [fetchBilling]);

  // Refresh billing
  const refresh = useCallback(async () => {
    await fetchBilling();
  }, [fetchBilling]);

  // Add payment method
  const addPaymentMethod = useCallback(
    async (token: string) => {
      try {
        setIsUpdating(true);

        const response = await fetch('/api/user/billing/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          throw new Error('Failed to add payment method');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  // Remove payment method
  const removePaymentMethod = useCallback(
    async (methodId: string) => {
      try {
        setIsUpdating(true);

        const response = await fetch(
          `/api/user/billing/payment-methods/${methodId}`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          throw new Error('Failed to remove payment method');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  // Set default payment method
  const setDefaultPaymentMethod = useCallback(
    async (methodId: string) => {
      try {
        setIsUpdating(true);

        const response = await fetch(
          `/api/user/billing/payment-methods/${methodId}/default`,
          {
            method: 'POST',
          },
        );

        if (!response.ok) {
          throw new Error('Failed to set default payment method');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  // Update subscription
  const updateSubscription = useCallback(
    async (plan: SubscriptionPlan) => {
      try {
        setIsUpdating(true);

        const response = await fetch('/api/user/billing/subscription', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });

        if (!response.ok) {
          throw new Error('Failed to update subscription');
        }

        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    try {
      setIsUpdating(true);

      const response = await fetch('/api/user/billing/subscription/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [refresh]);

  // Reactivate subscription
  const reactivateSubscription = useCallback(async () => {
    try {
      setIsUpdating(true);

      const response = await fetch('/api/user/billing/subscription/reactivate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }

      await refresh();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [refresh]);

  // Download invoice
  const downloadInvoice = useCallback(async (invoiceId: string) => {
    try {
      setIsUpdating(true);

      const response = await fetch(`/api/user/billing/invoices/${invoiceId}`);

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    billing,
    isLoading,
    error,
    refresh,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    downloadInvoice,
    isUpdating,
  };
}
