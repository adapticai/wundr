'use client';

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    users: number;
    storage: number;
    projects: number;
    apiCalls: number;
  };
  popular?: boolean;
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
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl: string;
}

interface Subscription {
  id: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UsageMetrics {
  users: { current: number; limit: number };
  storage: { current: number; limit: number };
  projects: { current: number; limit: number };
  apiCalls: { current: number; limit: number };
}

interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface TaxInfo {
  taxId: string;
  taxIdType: 'vat' | 'ein' | 'gst' | 'other';
  businessName: string;
}

export default function BillingSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [billingAddress, setBillingAddress] = useState<BillingAddress | null>(
    null
  );
  const [taxInfo, setTaxInfo] = useState<TaxInfo | null>(null);
  const [selectedTaxIdType, setSelectedTaxIdType] =
    useState<TaxInfo['taxIdType']>('vat');
  const [billingEmail, setBillingEmail] = useState('');
  const [sendInvoiceEmails, setSendInvoiceEmails] = useState(true);

  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showTaxDialog, setShowTaxDialog] = useState(false);

  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showRetentionOffer, setShowRetentionOffer] = useState(false);

  useEffect(() => {
    loadBillingData();
    loadAvailablePlans();
  }, []);

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [
        subscriptionRes,
        paymentMethodsRes,
        invoicesRes,
        usageRes,
        settingsRes,
      ] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/payment-methods'),
        fetch('/api/billing/invoices'),
        fetch('/api/billing/usage'),
        fetch('/api/billing/settings'),
      ]);

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json();
        setSubscription(subData.subscription);
        if (subData.currentPlan) {
          setCurrentPlan(subData.currentPlan);
        }
      }

      if (paymentMethodsRes.ok) {
        const pmData = await paymentMethodsRes.json();
        setPaymentMethods(pmData.paymentMethods);
      }

      if (invoicesRes.ok) {
        const invData = await invoicesRes.json();
        setInvoices(invData.invoices);
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsageMetrics(usageData.usage);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setBillingAddress(settingsData.billingAddress);
        setTaxInfo(settingsData.taxInfo);
        setBillingEmail(
          settingsData.billingEmail || session?.user?.email || ''
        );
        setSendInvoiceEmails(settingsData.sendInvoiceEmails ?? true);
      }
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load billing information',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    setPlansLoading(true);
    try {
      const response = await fetch('/api/billing/plans');
      if (response.ok) {
        const data = await response.json();
        setAvailablePlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  const handleChangePlan = async (plan: Plan) => {
    if (!currentPlan || plan.id === currentPlan.id) {
      return;
    }

    setProcessingAction('changePlan');
    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change plan');
      }

      toast({
        title: 'Success',
        description: `Successfully ${plan.price > (currentPlan?.price || 0) ? 'upgraded' : 'downgraded'} to ${plan.name} plan`,
      });

      await loadBillingData();
      setShowPlanDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to change plan',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleManagePaymentMethod = async () => {
    setProcessingAction('managePayment');
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to open billing portal',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRemovePaymentMethod = async (methodId: string) => {
    setProcessingAction(`removeCard-${methodId}`);
    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove payment method');
      }

      toast({
        title: 'Success',
        description: 'Payment method removed successfully',
      });

      await loadBillingData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to remove payment method',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    setProcessingAction(`setDefault-${methodId}`);
    try {
      const response = await fetch(
        `/api/billing/payment-methods/${methodId}/set-default`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || 'Failed to set default payment method'
        );
      }

      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });

      await loadBillingData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to set default payment method',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelSubscription = async () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancellation = async () => {
    setProcessingAction('cancelSubscription');
    try {
      const response = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      toast({
        title: 'Subscription Canceled',
        description:
          'Your subscription will remain active until the end of the current billing period',
      });

      await loadBillingData();
      setShowCancelDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUpdateBillingAddress = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setProcessingAction('updateAddress');

    const formData = new FormData(e.currentTarget);
    const address: BillingAddress = {
      line1: formData.get('line1') as string,
      line2: formData.get('line2') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      postalCode: formData.get('postalCode') as string,
      country: formData.get('country') as string,
    };

    try {
      const response = await fetch('/api/billing/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update billing address');
      }

      toast({
        title: 'Success',
        description: 'Billing address updated successfully',
      });

      await loadBillingData();
      setShowAddressDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update billing address',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUpdateTaxInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProcessingAction('updateTax');

    const formData = new FormData(e.currentTarget);
    const tax: TaxInfo = {
      taxId: formData.get('taxId') as string,
      taxIdType: selectedTaxIdType,
      businessName: formData.get('businessName') as string,
    };

    try {
      const response = await fetch('/api/billing/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tax),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update tax information');
      }

      toast({
        title: 'Success',
        description: 'Tax information updated successfully',
      });

      await loadBillingData();
      setShowTaxDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update tax information',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUpdateBillingEmail = async () => {
    setProcessingAction('updateEmail');
    try {
      const response = await fetch('/api/billing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingEmail,
          sendInvoiceEmails,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update billing settings');
      }

      toast({
        title: 'Success',
        description: 'Billing email settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update billing settings',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setProcessingAction(`downloadInvoice-${invoiceId}`);
    try {
      const response = await fetch(
        `/api/billing/invoices/${invoiceId}/download`
      );

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

      toast({
        title: 'Success',
        description: 'Invoice downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download invoice',
        variant: 'destructive',
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return '0 GB';
    }
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) {
      return 0;
    }
    return Math.min((current / limit) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          Billing & Subscription
        </h1>
        <p className='mt-1 text-muted-foreground'>
          Manage your subscription, payment methods, and billing information.
        </p>
      </div>

      <Tabs defaultValue='overview' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='plans'>Plans</TabsTrigger>
          <TabsTrigger value='payment'>Payment Methods</TabsTrigger>
          <TabsTrigger value='invoices'>Invoices</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    {currentPlan?.name === 'Enterprise' && (
                      <Crown className='h-5 w-5 text-amber-500' />
                    )}
                    {currentPlan?.name === 'Pro' && (
                      <Sparkles className='h-5 w-5 text-purple-500' />
                    )}
                    {currentPlan?.name} Plan
                  </CardTitle>
                  <CardDescription>{currentPlan?.description}</CardDescription>
                </div>
                <Badge
                  variant={
                    subscription?.status === 'active'
                      ? 'default'
                      : subscription?.status === 'trialing'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {subscription?.status || 'Free'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold'>
                  {formatCurrency(currentPlan?.price || 0)}
                </span>
                <span className='text-muted-foreground'>
                  /{currentPlan?.interval}
                </span>
              </div>

              {subscription && (
                <div className='space-y-2 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>
                      Current period ends
                    </span>
                    <span className='font-medium'>
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <div className='flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-amber-900 dark:text-amber-100'>
                      <AlertCircle className='h-4 w-4' />
                      <span className='text-sm'>
                        Your subscription will be canceled at the end of the
                        current period
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>Plan Features</h4>
                <ul className='grid gap-2 text-sm'>
                  {currentPlan?.features.map((feature, index) => (
                    <li key={index} className='flex items-start gap-2'>
                      <Check className='h-4 w-4 text-green-500 mt-0.5 shrink-0' />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter className='flex gap-2'>
              <Button
                onClick={() => setShowPlanDialog(true)}
                className='flex-1'
              >
                <TrendingUp className='mr-2 h-4 w-4' />
                {currentPlan?.id === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </Button>
              {subscription && !subscription.cancelAtPeriodEnd && (
                <Button
                  variant='outline'
                  onClick={() => setShowCancelDialog(true)}
                  className='flex-1'
                >
                  Cancel Subscription
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Usage Metrics */}
          {usageMetrics && currentPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
                <CardDescription>
                  Track your usage against plan limits
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-2'>
                      <Users className='h-4 w-4 text-muted-foreground' />
                      <span>Team Members</span>
                    </div>
                    <span className='font-medium'>
                      {usageMetrics.users.current} /{' '}
                      {currentPlan.limits.users === -1
                        ? 'Unlimited'
                        : currentPlan.limits.users}
                    </span>
                  </div>
                  {currentPlan.limits.users !== -1 && (
                    <Progress
                      value={getUsagePercentage(
                        usageMetrics.users.current,
                        currentPlan.limits.users
                      )}
                    />
                  )}
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-2'>
                      <Zap className='h-4 w-4 text-muted-foreground' />
                      <span>Storage</span>
                    </div>
                    <span className='font-medium'>
                      {formatBytes(usageMetrics.storage.current)} /{' '}
                      {currentPlan.limits.storage === -1
                        ? 'Unlimited'
                        : `${currentPlan.limits.storage} GB`}
                    </span>
                  </div>
                  {currentPlan.limits.storage !== -1 && (
                    <Progress
                      value={getUsagePercentage(
                        usageMetrics.storage.current / (1024 * 1024 * 1024),
                        currentPlan.limits.storage
                      )}
                    />
                  )}
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-2'>
                      <Calendar className='h-4 w-4 text-muted-foreground' />
                      <span>Projects</span>
                    </div>
                    <span className='font-medium'>
                      {usageMetrics.projects.current} /{' '}
                      {currentPlan.limits.projects === -1
                        ? 'Unlimited'
                        : currentPlan.limits.projects}
                    </span>
                  </div>
                  {currentPlan.limits.projects !== -1 && (
                    <Progress
                      value={getUsagePercentage(
                        usageMetrics.projects.current,
                        currentPlan.limits.projects
                      )}
                    />
                  )}
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-2'>
                      <Zap className='h-4 w-4 text-muted-foreground' />
                      <span>API Calls</span>
                    </div>
                    <span className='font-medium'>
                      {usageMetrics.apiCalls.current.toLocaleString()} /{' '}
                      {currentPlan.limits.apiCalls === -1
                        ? 'Unlimited'
                        : currentPlan.limits.apiCalls.toLocaleString()}
                    </span>
                  </div>
                  {currentPlan.limits.apiCalls !== -1 && (
                    <Progress
                      value={getUsagePercentage(
                        usageMetrics.apiCalls.current,
                        currentPlan.limits.apiCalls
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Method */}
          {paymentMethods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Default Payment Method</CardTitle>
                <CardDescription>
                  Used for automatic billing charges
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const defaultMethod = paymentMethods.find(pm => pm.isDefault);
                  if (!defaultMethod) {
                    return null;
                  }

                  return (
                    <div className='flex items-center gap-4 rounded-lg border p-4'>
                      <CreditCard className='h-8 w-8 text-muted-foreground' />
                      <div className='flex-1'>
                        <p className='font-medium'>
                          {defaultMethod.brand} •••• {defaultMethod.last4}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          Expires {defaultMethod.expiryMonth}/
                          {defaultMethod.expiryYear}
                        </p>
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={handleManagePaymentMethod}
                        disabled={processingAction === 'managePayment'}
                      >
                        {processingAction === 'managePayment' ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          'Manage'
                        )}
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='plans' className='space-y-6'>
          {plansLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : availablePlans.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <TrendingUp className='h-12 w-12 text-muted-foreground mb-4' />
                <h3 className='text-lg font-semibold mb-2'>
                  Plans unavailable
                </h3>
                <p className='text-sm text-muted-foreground mb-4 max-w-sm'>
                  Plan information could not be loaded. Please try again or
                  contact support to discuss available options.
                </p>
                <div className='flex gap-2'>
                  <Button variant='outline' onClick={loadAvailablePlans}>
                    Try Again
                  </Button>
                  <Button asChild>
                    <a href='mailto:support@adaptic.ai'>Contact Support</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-6 md:grid-cols-3'>
              {availablePlans.map(plan => (
                <Card
                  key={plan.id}
                  className={
                    plan.id === currentPlan?.id
                      ? 'border-primary shadow-lg'
                      : plan.popular
                        ? 'border-purple-500 shadow-md'
                        : ''
                  }
                >
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div>
                        <CardTitle className='flex items-center gap-2'>
                          {plan.name === 'Enterprise' && (
                            <Crown className='h-5 w-5 text-amber-500' />
                          )}
                          {plan.name === 'Pro' && (
                            <Sparkles className='h-5 w-5 text-purple-500' />
                          )}
                          {plan.name}
                        </CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </div>
                      {plan.popular && (
                        <Badge variant='secondary'>Popular</Badge>
                      )}
                      {plan.id === currentPlan?.id && (
                        <Badge variant='default'>Current</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-baseline gap-2'>
                      <span className='text-3xl font-bold'>
                        {formatCurrency(plan.price)}
                      </span>
                      <span className='text-muted-foreground'>
                        /{plan.interval}
                      </span>
                    </div>

                    <Separator />

                    <ul className='space-y-2 text-sm'>
                      {plan.features.map((feature, index) => (
                        <li key={index} className='flex items-start gap-2'>
                          <Check className='h-4 w-4 text-green-500 mt-0.5 shrink-0' />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {plan.id === currentPlan?.id ? (
                      <Button className='w-full' disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className='w-full'
                        variant={
                          plan.price > (currentPlan?.price || 0)
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() => {
                          setSelectedPlan(plan);
                          setShowPlanDialog(true);
                        }}
                      >
                        {plan.price > (currentPlan?.price || 0)
                          ? 'Upgrade'
                          : 'Downgrade'}
                        <ChevronRight className='ml-2 h-4 w-4' />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='payment' className='space-y-6'>
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>
                    Manage your credit cards and payment options
                  </CardDescription>
                </div>
                <Button
                  onClick={handleManagePaymentMethod}
                  disabled={processingAction === 'managePayment'}
                >
                  {processingAction === 'managePayment' ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <ExternalLink className='mr-2 h-4 w-4' />
                  )}
                  Manage in Portal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <CreditCard className='h-12 w-12 text-muted-foreground mb-4' />
                  <h3 className='text-lg font-semibold mb-2'>
                    No payment methods
                  </h3>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Add a payment method to enable automatic billing. You will
                    be redirected to our secure payment portal.
                  </p>
                  <Button
                    onClick={handleManagePaymentMethod}
                    disabled={processingAction === 'managePayment'}
                  >
                    {processingAction === 'managePayment' ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <ExternalLink className='mr-2 h-4 w-4' />
                    )}
                    Add Payment Method
                  </Button>
                </div>
              ) : (
                <div className='space-y-4'>
                  {paymentMethods.map(method => (
                    <div
                      key={method.id}
                      className='flex items-center gap-4 rounded-lg border p-4'
                    >
                      <CreditCard className='h-8 w-8 text-muted-foreground' />
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <p className='font-medium'>
                            {method.brand} •••• {method.last4}
                          </p>
                          {method.isDefault && (
                            <Badge variant='secondary'>Default</Badge>
                          )}
                        </div>
                        <p className='text-sm text-muted-foreground'>
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </p>
                      </div>
                      <div className='flex gap-2'>
                        {!method.isDefault && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              handleSetDefaultPaymentMethod(method.id)
                            }
                            disabled={
                              processingAction === `setDefault-${method.id}`
                            }
                          >
                            {processingAction === `setDefault-${method.id}` ? (
                              <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                              'Set Default'
                            )}
                          </Button>
                        )}
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleRemovePaymentMethod(method.id)}
                          disabled={
                            method.isDefault ||
                            processingAction === `removeCard-${method.id}`
                          }
                        >
                          {processingAction === `removeCard-${method.id}` ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <Trash2 className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='invoices' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Download past invoices and receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <Calendar className='h-12 w-12 text-muted-foreground mb-4' />
                  <h3 className='text-lg font-semibold mb-2'>
                    No invoices yet
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Your billing history will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell className='font-medium'>
                          {invoice.number}
                        </TableCell>
                        <TableCell>{formatDate(invoice.date)}</TableCell>
                        <TableCell>{formatCurrency(invoice.amount)}</TableCell>
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
                            disabled={
                              processingAction ===
                              `downloadInvoice-${invoice.id}`
                            }
                          >
                            {processingAction ===
                            `downloadInvoice-${invoice.id}` ? (
                              <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                              <>
                                <Download className='mr-2 h-4 w-4' />
                                Download
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='settings' className='space-y-6'>
          {/* Billing Email */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Email</CardTitle>
              <CardDescription>
                Where you receive invoices and billing notifications
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='billingEmail'>Email Address</Label>
                <div className='flex gap-2'>
                  <div className='relative flex-1'>
                    <Mail className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input
                      id='billingEmail'
                      type='email'
                      value={billingEmail}
                      onChange={e => setBillingEmail(e.target.value)}
                      className='pl-10'
                      placeholder='billing@example.com'
                    />
                  </div>
                  <Button
                    onClick={handleUpdateBillingEmail}
                    disabled={processingAction === 'updateEmail'}
                  >
                    {processingAction === 'updateEmail' ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      'Update'
                    )}
                  </Button>
                </div>
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='sendInvoices'>Send Invoice Emails</Label>
                  <p className='text-sm text-muted-foreground'>
                    Receive email notifications when new invoices are available
                  </p>
                </div>
                <Switch
                  id='sendInvoices'
                  checked={sendInvoiceEmails}
                  onCheckedChange={value => {
                    setSendInvoiceEmails(value);
                    handleUpdateBillingEmail();
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle>Billing Address</CardTitle>
                  <CardDescription>
                    Address shown on your invoices
                  </CardDescription>
                </div>
                <Button
                  variant='outline'
                  onClick={() => setShowAddressDialog(true)}
                >
                  <MapPin className='mr-2 h-4 w-4' />
                  {billingAddress ? 'Update' : 'Add'} Address
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {billingAddress ? (
                <div className='space-y-1 text-sm'>
                  <p>{billingAddress.line1}</p>
                  {billingAddress.line2 && <p>{billingAddress.line2}</p>}
                  <p>
                    {billingAddress.city}, {billingAddress.state}{' '}
                    {billingAddress.postalCode}
                  </p>
                  <p>{billingAddress.country}</p>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No billing address set
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tax Information */}
          <Card>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle>Tax Information</CardTitle>
                  <CardDescription>
                    VAT ID, EIN, or other tax identification
                  </CardDescription>
                </div>
                <Button
                  variant='outline'
                  onClick={() => {
                    setSelectedTaxIdType(taxInfo?.taxIdType || 'vat');
                    setShowTaxDialog(true);
                  }}
                >
                  {taxInfo ? 'Update' : 'Add'} Tax Info
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {taxInfo ? (
                <div className='space-y-1 text-sm'>
                  <p className='font-medium'>{taxInfo.businessName}</p>
                  <p className='text-muted-foreground'>
                    {taxInfo.taxIdType.toUpperCase()}: {taxInfo.taxId}
                  </p>
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No tax information set
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Plan Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && selectedPlan.price > (currentPlan?.price || 0)
                ? 'Upgrade'
                : 'Change'}{' '}
              Plan
            </DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>
                  You're about to{' '}
                  {selectedPlan.price > (currentPlan?.price || 0)
                    ? 'upgrade'
                    : 'change'}{' '}
                  to the <strong>{selectedPlan.name}</strong> plan
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className='space-y-4'>
              <div className='rounded-lg border p-4'>
                <div className='flex items-baseline gap-2 mb-4'>
                  <span className='text-3xl font-bold'>
                    {formatCurrency(selectedPlan.price)}
                  </span>
                  <span className='text-muted-foreground'>
                    /{selectedPlan.interval}
                  </span>
                </div>
                <ul className='space-y-2 text-sm'>
                  {selectedPlan.features.slice(0, 5).map((feature, index) => (
                    <li key={index} className='flex items-start gap-2'>
                      <Check className='h-4 w-4 text-green-500 mt-0.5 shrink-0' />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedPlan.price > (currentPlan?.price || 0) && (
                <p className='text-sm text-muted-foreground'>
                  You'll be charged prorated for the remainder of your current
                  billing period.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowPlanDialog(false)}
              disabled={processingAction === 'changePlan'}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPlan && handleChangePlan(selectedPlan)}
              disabled={processingAction === 'changePlan'}
            >
              {processingAction === 'changePlan' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing...
                </>
              ) : (
                'Confirm Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of your current
              billing period. You'll lose access to premium features after that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancellation}
              disabled={processingAction === 'cancelSubscription'}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {processingAction === 'cancelSubscription' ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing...
                </>
              ) : (
                'Cancel Subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Billing Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {billingAddress ? 'Update' : 'Add'} Billing Address
            </DialogTitle>
            <DialogDescription>
              This address will appear on your invoices
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBillingAddress} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='line1'>Address Line 1</Label>
              <Input
                id='line1'
                name='line1'
                defaultValue={billingAddress?.line1}
                placeholder='123 Main St'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='line2'>Address Line 2 (Optional)</Label>
              <Input
                id='line2'
                name='line2'
                defaultValue={billingAddress?.line2}
                placeholder='Apt 4B'
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='city'>City</Label>
                <Input
                  id='city'
                  name='city'
                  defaultValue={billingAddress?.city}
                  placeholder='San Francisco'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='state'>State / Province</Label>
                <Input
                  id='state'
                  name='state'
                  defaultValue={billingAddress?.state}
                  placeholder='CA'
                  required
                />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='postalCode'>Postal Code</Label>
                <Input
                  id='postalCode'
                  name='postalCode'
                  defaultValue={billingAddress?.postalCode}
                  placeholder='94102'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='country'>Country</Label>
                <Input
                  id='country'
                  name='country'
                  defaultValue={billingAddress?.country}
                  placeholder='United States'
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowAddressDialog(false)}
                disabled={processingAction === 'updateAddress'}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={processingAction === 'updateAddress'}
              >
                {processingAction === 'updateAddress' ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Saving...
                  </>
                ) : (
                  'Save Address'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tax Info Dialog */}
      <Dialog open={showTaxDialog} onOpenChange={setShowTaxDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {taxInfo ? 'Update' : 'Add'} Tax Information
            </DialogTitle>
            <DialogDescription>
              Provide your business tax identification for invoicing
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTaxInfo} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='businessName'>Business Name</Label>
              <Input
                id='businessName'
                name='businessName'
                defaultValue={taxInfo?.businessName}
                placeholder='Acme Inc.'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='taxIdType'>Tax ID Type</Label>
              <Select
                value={selectedTaxIdType}
                onValueChange={(value: TaxInfo['taxIdType']) =>
                  setSelectedTaxIdType(value)
                }
              >
                <SelectTrigger id='taxIdType'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='vat'>VAT</SelectItem>
                  <SelectItem value='ein'>EIN</SelectItem>
                  <SelectItem value='gst'>GST</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='taxId'>Tax ID Number</Label>
              <Input
                id='taxId'
                name='taxId'
                defaultValue={taxInfo?.taxId}
                placeholder='GB123456789'
                required
              />
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowTaxDialog(false)}
                disabled={processingAction === 'updateTax'}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={processingAction === 'updateTax'}>
                {processingAction === 'updateTax' ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Saving...
                  </>
                ) : (
                  'Save Tax Info'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
