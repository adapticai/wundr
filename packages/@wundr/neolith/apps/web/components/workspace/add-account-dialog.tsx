'use client';

import { Mail } from 'lucide-react';

import { GitHubIcon, GoogleIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog for linking additional accounts to access more workspaces.
 *
 * STUB IMPLEMENTATION:
 * This is a placeholder component that shows auth provider options.
 * The actual account linking flow requires:
 *
 * TODO: Schema Changes Required
 * - Add Account table to support multiple auth providers per user
 * - Add user_id foreign key to link accounts to User profile
 * - Add provider and provider_account_id fields for OAuth
 * - Add unique constraint on (provider, provider_account_id)
 *
 * TODO: Account Linking Flow
 * 1. User clicks provider button
 * 2. OAuth flow authenticates with provider
 * 3. Backend checks if provider account already exists
 * 4. If exists and linked to different user: Show error
 * 5. If exists and linked to current user: Show "already linked"
 * 6. If new: Create Account record linked to current user
 * 7. Fetch workspaces associated with the new account
 * 8. Update workspace switcher to show new workspaces
 *
 * TODO: API Endpoints Required
 * - POST /api/auth/link-account - Initiate account linking
 * - GET /api/auth/linked-accounts - Get all accounts for current user
 * - DELETE /api/auth/linked-accounts/[id] - Unlink an account
 * - GET /api/workspaces/from-accounts - Get workspaces from all linked accounts
 *
 * TODO: Security Considerations
 * - Verify user is authenticated before allowing account linking
 * - Prevent linking same provider account to multiple users
 * - Add confirmation step for account unlinking
 * - Log account linking/unlinking events for audit trail
 *
 * INTERIM SOLUTION:
 * Direct users to sign out and sign in with another account to access
 * workspaces associated with different providers.
 */
export function AddAccountDialog({ isOpen, onClose }: AddAccountDialogProps) {
  // TODO: Add loading state when account linking is implemented
  // const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Link another account to access additional workspaces.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Info Banner */}
          <div className='rounded-md bg-muted p-3 text-sm'>
            <p className='font-medium mb-1'>Feature Coming Soon</p>
            <p className='text-muted-foreground'>
              Account linking is not yet available. To access workspaces from
              another account, please sign out and sign in with that account.
            </p>
          </div>

          {/* OAuth Provider Buttons (Disabled) */}
          <div className='space-y-3 opacity-50'>
            <Button
              variant='outline'
              size='lg'
              className='w-full'
              onClick={() => {
                /* TODO: Implement account linking */
              }}
              disabled={true}
            >
              <GitHubIcon className='mr-2 h-5 w-5' />
              Link GitHub Account
            </Button>

            <Button
              variant='outline'
              size='lg'
              className='w-full'
              onClick={() => {
                /* TODO: Implement account linking */
              }}
              disabled={true}
            >
              <GoogleIcon className='mr-2 h-5 w-5' />
              Link Google Account
            </Button>

            <Button
              variant='outline'
              size='lg'
              className='w-full'
              onClick={() => {
                /* TODO: Implement account linking */
              }}
              disabled={true}
            >
              <Mail className='mr-2 h-5 w-5' />
              Link Email Account
            </Button>
          </div>

          {/* Current Workaround Instructions */}
          <div className='rounded-md border border-border p-3 text-sm space-y-2'>
            <p className='font-medium'>Current Workaround:</p>
            <ol className='list-decimal list-inside space-y-1 text-muted-foreground'>
              <li>Click your profile menu in the top right</li>
              <li>Select "Sign out"</li>
              <li>Sign in with a different account</li>
              <li>Access workspaces from that account</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
