'use client';

import {
  Loader2,
  CreditCard,
  Plus,
  Trash2,
  Star,
  Download,
  Receipt,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethod {
  id: string;
  type: 'card';
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  holderName: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  createdAt: string;
  dueDate: string;
  downloadUrl: string;
}

/**
 * Payment Methods Settings Page
 *
 * Manage workspace payment methods and billing history:
 * - View saved payment methods (cards)
 * - Add new payment method
 * - Set default payment method
 * - Remove payment methods
 * - View billing history and download invoices
 */
export default function PaymentMethodsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();

  // Data State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Form State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Fetch payment methods and invoices
  const fetchData = useCallback(async () => {
    if (!workspaceSlug) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/billing/payment-methods`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch payment data');
      }
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
      setInvoices(data.invoices || []);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to load payment data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddPaymentMethod = useCallback(async () => {
    if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear || !cvv) {
      toast({
        title: 'Error',
        description: 'Please fill in all card details',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCard(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/billing/payment-methods`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardNumber,
            cardHolder,
            expiryMonth: parseInt(expiryMonth),
            expiryYear: parseInt(expiryYear),
            cvv,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add payment method');
      }

      await fetchData();

      // Reset form
      setCardNumber('');
      setCardHolder('');
      setExpiryMonth('');
      setExpiryYear('');
      setCvv('');
      setShowAddForm(false);

      toast({
        title: 'Success',
        description: 'Payment method added successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to add payment method',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCard(false);
    }
  }, [
    workspaceSlug,
    cardNumber,
    cardHolder,
    expiryMonth,
    expiryYear,
    cvv,
    toast,
    fetchData,
  ]);

  const handleSetDefault = useCallback(
    async (id: string) => {
      setSettingDefaultId(id);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/billing/payment-methods`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultPaymentMethodId: id }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to set default payment method');
        }

        await fetchData();

        toast({
          title: 'Success',
          description: 'Default payment method updated',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to update default',
          variant: 'destructive',
        });
      } finally {
        setSettingDefaultId(null);
      }
    },
    [workspaceSlug, toast, fetchData]
  );

  const handleDeletePaymentMethod = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/billing/payment-methods?id=${id}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          throw new Error('Failed to delete payment method');
        }

        await fetchData();

        toast({
          title: 'Success',
          description: 'Payment method removed',
        });
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
        setDeletingId(null);
      }
    },
    [workspaceSlug, toast, fetchData]
  );

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const getCardBrandIcon = (_brand: string) => {
    return <CreditCard className='h-5 w-5' />;
  };

  if (isLoading) {
    return <PaymentMethodsSkeleton />;
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Payment Methods</h1>
        <p className='mt-1 text-muted-foreground'>
          Manage payment methods and view billing history
        </p>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <CreditCard className='h-5 w-5' />
                Payment Methods
              </CardTitle>
              <CardDescription>
                Manage your saved payment methods for workspace billing
              </CardDescription>
            </div>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} size='sm'>
                <Plus className='h-4 w-4 mr-2' />
                Add Payment Method
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Existing Payment Methods */}
          {paymentMethods.length > 0 ? (
            <div className='space-y-3'>
              {paymentMethods.map(method => (
                <div
                  key={method.id}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='flex items-center gap-4'>
                    {getCardBrandIcon(method.brand)}
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium'>
                          {method.brand} •••• {method.last4}
                        </p>
                        {method.isDefault && (
                          <Badge variant='default' className='h-5'>
                            <Star className='h-3 w-3 mr-1' />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className='text-sm text-muted-foreground'>
                        {method.holderName} • Expires {method.expiryMonth}/
                        {method.expiryYear}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {!method.isDefault && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleSetDefault(method.id)}
                        disabled={settingDefaultId === method.id}
                      >
                        {settingDefaultId === method.id ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          'Set as Default'
                        )}
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      disabled={deletingId === method.id}
                    >
                      {deletingId === method.id ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Trash2 className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <CreditCard className='h-12 w-12 text-muted-foreground mb-4' />
              <p className='text-sm text-muted-foreground'>
                No payment methods saved yet
              </p>
            </div>
          )}

          {/* Add Payment Method Form */}
          {showAddForm && (
            <div className='rounded-lg border border-dashed p-4 space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-medium'>Add New Card</h3>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowAddForm(false)}
                  disabled={isAddingCard}
                >
                  Cancel
                </Button>
              </div>

              <div className='grid gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='card-number'>Card Number</Label>
                  <Input
                    id='card-number'
                    value={formatCardNumber(cardNumber)}
                    onChange={e =>
                      setCardNumber(e.target.value.replace(/\s/g, ''))
                    }
                    placeholder='1234 5678 9012 3456'
                    maxLength={19}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='card-holder'>Cardholder Name</Label>
                  <Input
                    id='card-holder'
                    value={cardHolder}
                    onChange={e => setCardHolder(e.target.value)}
                    placeholder='John Doe'
                  />
                </div>

                <div className='grid grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='expiry-month'>Month</Label>
                    <Select value={expiryMonth} onValueChange={setExpiryMonth}>
                      <SelectTrigger id='expiry-month'>
                        <SelectValue placeholder='MM' />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          month => (
                            <SelectItem
                              key={month}
                              value={month.toString().padStart(2, '0')}
                            >
                              {month.toString().padStart(2, '0')}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='expiry-year'>Year</Label>
                    <Select value={expiryYear} onValueChange={setExpiryYear}>
                      <SelectTrigger id='expiry-year'>
                        <SelectValue placeholder='YYYY' />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: 10 },
                          (_, i) => new Date().getFullYear() + i
                        ).map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='cvv'>CVV</Label>
                    <Input
                      id='cvv'
                      type='password'
                      value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, ''))}
                      placeholder='123'
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              <div className='flex justify-end pt-2'>
                <Button
                  onClick={handleAddPaymentMethod}
                  disabled={isAddingCard}
                >
                  {isAddingCard ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Adding...
                    </>
                  ) : (
                    'Add Payment Method'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Receipt className='h-5 w-5' />
            Billing History
          </CardTitle>
          <CardDescription>View and download your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className='space-y-2'>
              {invoices.map(invoice => (
                <div
                  key={invoice.id}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='flex items-center gap-4'>
                    <Receipt className='h-5 w-5 text-muted-foreground' />
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium'>{invoice.invoiceNumber}</p>
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
                      </div>
                      <p className='text-sm text-muted-foreground'>
                        {new Date(invoice.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}
                        {invoice.status === 'pending' && (
                          <span className='ml-2'>
                            • Due{' '}
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <p className='font-semibold'>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: invoice.currency.toUpperCase(),
                      }).format(invoice.amount)}
                    </p>
                    <Button variant='outline' size='sm' asChild>
                      <a href={invoice.downloadUrl} download>
                        <Download className='h-4 w-4 mr-2' />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Receipt className='h-12 w-12 text-muted-foreground mb-4' />
              <p className='text-sm text-muted-foreground'>No invoices yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentMethodsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='h-8 w-64 animate-pulse rounded bg-muted' />
        <div className='h-4 w-96 animate-pulse rounded bg-muted' />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className='h-6 w-48 animate-pulse rounded bg-muted' />
            <div className='h-4 w-full animate-pulse rounded bg-muted' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='h-20 w-full animate-pulse rounded bg-muted' />
            <div className='h-20 w-full animate-pulse rounded bg-muted' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
