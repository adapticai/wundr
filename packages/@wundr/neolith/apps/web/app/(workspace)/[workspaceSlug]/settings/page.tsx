'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import {
  User,
  Bell,
  Palette,
  Shield,
  Plug,
  CheckCircle2,
  AlertCircle,
  Mail,
  ChevronRight,
} from 'lucide-react';

interface SettingsCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function SettingsCard({ title, description, href, icon }: SettingsCardProps) {
  return (
    <Link href={href}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AccountOverviewPage() {
  const { setPageHeader } = usePageHeader();
  const { data: session, status } = useSession();
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;

  useEffect(() => {
    setPageHeader('Account Overview', 'Manage your account and preferences');
  }, [setPageHeader]);

  const isLoading = status === 'loading';

  // Calculate account health metrics
  const hasAvatar = !!session?.user?.image;
  const hasName = !!session?.user?.name;
  const hasEmail = !!session?.user?.email;
  const isEmailVerified = true; // TODO: Get from session/user data

  const completionItems = [
    { label: 'Profile picture', completed: hasAvatar },
    { label: 'Display name', completed: hasName },
    { label: 'Email address', completed: hasEmail },
    { label: 'Email verified', completed: isEmailVerified },
  ];

  const completionPercentage = Math.round(
    (completionItems.filter((item) => item.completed).length / completionItems.length) * 100
  );

  if (isLoading) {
    return <AccountOverviewSkeleton />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Account Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle>Account Summary</CardTitle>
          <CardDescription>Your account information at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Large Avatar */}
            <Avatar className="h-24 w-24" shape="lg">
              <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
              <AvatarFallback className="text-2xl" shape="lg">
                {session?.user?.name
                  ? session.user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                  : 'U'}
              </AvatarFallback>
            </Avatar>

            {/* User Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-2xl font-bold">{session?.user?.name || 'User'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {session?.user?.email || 'No email set'}
                  </span>
                  {isEmailVerified && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick action link */}
              <Link
                href={`/${workspaceSlug}/settings/profile`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Edit Profile
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Health/Completion */}
      {completionPercentage < 100 && (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                  Complete Your Profile
                </CardTitle>
                <CardDescription>
                  {completionPercentage}% complete - finish setting up your account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {completionItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span
                    className={`text-sm ${
                      item.completed
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsCard
            title="Profile & Account"
            description="Manage your personal information and preferences"
            href={`/${workspaceSlug}/settings/profile`}
            icon={<User className="h-5 w-5" />}
          />
          <SettingsCard
            title="Notifications"
            description="Control how and when you receive notifications"
            href={`/${workspaceSlug}/settings/notifications`}
            icon={<Bell className="h-5 w-5" />}
          />
          <SettingsCard
            title="Appearance"
            description="Customize the look and feel of your workspace"
            href={`/${workspaceSlug}/settings/appearance`}
            icon={<Palette className="h-5 w-5" />}
          />
          <SettingsCard
            title="Security"
            description="Manage your account security and privacy"
            href={`/${workspaceSlug}/settings/security`}
            icon={<Shield className="h-5 w-5" />}
          />
          <SettingsCard
            title="Integrations"
            description="Connect third-party apps and services"
            href={`/${workspaceSlug}/settings/integrations`}
            icon={<Plug className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Security Score (Optional - can be expanded later) */}
      <Card>
        <CardHeader>
          <CardTitle>Security Status</CardTitle>
          <CardDescription>Keep your account safe and secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                <span className="text-sm font-medium">Strong password</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                <span className="text-sm font-medium">Two-factor authentication</span>
              </div>
              <Link
                href={`/${workspaceSlug}/settings/security`}
                className="text-sm text-primary hover:underline"
              >
                Enable
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                <span className="text-sm font-medium">Email verified</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading skeleton component
function AccountOverviewSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      {/* Account Summary Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Cards Skeleton */}
      <div>
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Security Status Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
