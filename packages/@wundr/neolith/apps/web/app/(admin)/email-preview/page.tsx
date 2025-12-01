'use client';

/**
 * Email Preview Page
 *
 * Development tool for previewing and testing email templates.
 * Provides a UI for selecting templates, filling in props, and viewing rendered emails.
 *
 * Features:
 * - Template selection dropdown
 * - Dynamic form based on template type
 * - Live preview iframe
 * - Send test email functionality
 *
 * @module app/(admin)/email-preview/page
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'verification'
  | 'invitation'
  | 'notification'
  | 'password-changed';

interface TemplateProps {
  [key: string]: string;
}

export default function EmailPreviewPage() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate>('welcome');
  const [previewProps, setPreviewProps] = useState<TemplateProps>({
    email: 'test@example.com',
    username: 'Test User',
  });
  const [previewKey, setPreviewKey] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Template-specific form fields
  const templateFields: Record<
    EmailTemplate,
    Array<{ name: string; label: string; type?: string; options?: string[] }>
  > = {
    welcome: [
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username' },
      { name: 'loginUrl', label: 'Login URL (optional)' },
    ],
    'password-reset': [
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username (optional)' },
      { name: 'resetUrl', label: 'Reset URL (optional)' },
    ],
    verification: [
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username (optional)' },
      { name: 'verificationUrl', label: 'Verification URL (optional)' },
    ],
    invitation: [
      { name: 'email', label: 'Email' },
      { name: 'inviterName', label: 'Inviter Name' },
      { name: 'inviterEmail', label: 'Inviter Email' },
      { name: 'workspaceName', label: 'Workspace Name' },
      { name: 'inviteUrl', label: 'Invite URL (optional)' },
    ],
    notification: [
      { name: 'email', label: 'Email' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: ['mention', 'message', 'channel', 'task', 'system'],
      },
      { name: 'title', label: 'Title' },
      { name: 'message', label: 'Message' },
      { name: 'actionText', label: 'Action Text (optional)' },
      { name: 'actionUrl', label: 'Action URL (optional)' },
    ],
    'password-changed': [
      { name: 'email', label: 'Email' },
      { name: 'username', label: 'Username' },
      { name: 'ipAddress', label: 'IP Address (optional)' },
    ],
  };

  // Default props for each template
  const defaultProps: Record<EmailTemplate, TemplateProps> = {
    welcome: {
      email: 'test@example.com',
      username: 'Test User',
    },
    'password-reset': {
      email: 'test@example.com',
      username: 'Test User',
    },
    verification: {
      email: 'test@example.com',
      username: 'Test User',
    },
    invitation: {
      email: 'test@example.com',
      inviterName: 'John Doe',
      inviterEmail: 'john@example.com',
      workspaceName: 'Acme Corp',
    },
    notification: {
      email: 'test@example.com',
      type: 'message',
      title: 'New Message',
      message: 'You have a new message from John Doe.',
      actionText: 'View Message',
    },
    'password-changed': {
      email: 'test@example.com',
      username: 'Test User',
      ipAddress: '192.168.1.1',
    },
  };

  const handleTemplateChange = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewProps(defaultProps[template]);
    setSendResult(null);
    setPreviewKey(prev => prev + 1);
  };

  const handlePropChange = (name: string, value: string) => {
    setPreviewProps(prev => ({ ...prev, [name]: value }));
  };

  const handleRefreshPreview = () => {
    setPreviewKey(prev => prev + 1);
    setSendResult(null);
  };

  const handleSendTestEmail = async () => {
    setSendingEmail(true);
    setSendResult(null);

    try {
      const response = await fetch('/api/admin/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: selectedTemplate,
          to: previewProps.email,
          props: previewProps,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSendResult({
          success: true,
          message: `Email sent successfully to ${previewProps.email}`,
        });
      } else {
        setSendResult({
          success: false,
          message: data.error || 'Failed to send email',
        });
      }
    } catch (error) {
      setSendResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Build preview URL with query parameters
  const buildPreviewUrl = () => {
    const params = new URLSearchParams({
      template: selectedTemplate,
      ...previewProps,
    });
    return `/api/admin/email-preview?${params.toString()}`;
  };

  return (
    <div className='container mx-auto p-8 max-w-7xl'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-2'>Email Template Preview</h1>
        <p className='text-muted-foreground'>
          Preview and test email templates. Only available in development mode.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Left Panel: Controls */}
        <div className='lg:col-span-1 space-y-6'>
          {/* Template Selection */}
          <Card className='p-4'>
            <h2 className='text-lg font-semibold mb-4'>Select Template</h2>
            <select
              value={selectedTemplate}
              onChange={e =>
                handleTemplateChange(e.target.value as EmailTemplate)
              }
              className='w-full p-2 border rounded-md bg-background'
            >
              <option value='welcome'>Welcome Email</option>
              <option value='password-reset'>Password Reset</option>
              <option value='verification'>Email Verification</option>
              <option value='invitation'>Workspace Invitation</option>
              <option value='notification'>Notification</option>
              <option value='password-changed'>Password Changed</option>
            </select>
          </Card>

          {/* Template Properties */}
          <Card className='p-4'>
            <h2 className='text-lg font-semibold mb-4'>Template Properties</h2>
            <div className='space-y-4'>
              {templateFields[selectedTemplate].map(field => (
                <div key={field.name}>
                  <label className='block text-sm font-medium mb-1'>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={previewProps[field.name] || ''}
                      onChange={e =>
                        handlePropChange(field.name, e.target.value)
                      }
                      className='w-full p-2 border rounded-md bg-background text-sm'
                    >
                      {field.options?.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type='text'
                      value={previewProps[field.name] || ''}
                      onChange={e =>
                        handlePropChange(field.name, e.target.value)
                      }
                      placeholder={field.label}
                      className='w-full p-2 border rounded-md bg-background text-sm'
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <Card className='p-4'>
            <h2 className='text-lg font-semibold mb-4'>Actions</h2>
            <div className='space-y-3'>
              <Button
                onClick={handleRefreshPreview}
                className='w-full'
                variant='outline'
              >
                Refresh Preview
              </Button>
              <Button
                onClick={handleSendTestEmail}
                disabled={sendingEmail}
                className='w-full'
              >
                {sendingEmail ? 'Sending...' : 'Send Test Email'}
              </Button>
            </div>

            {sendResult && (
              <div
                className={`mt-4 p-3 rounded-md text-sm ${
                  sendResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {sendResult.message}
              </div>
            )}
          </Card>
        </div>

        {/* Right Panel: Preview */}
        <div className='lg:col-span-2'>
          <Card className='p-4 h-full'>
            <h2 className='text-lg font-semibold mb-4'>Email Preview</h2>
            <div
              className='border rounded-lg overflow-hidden bg-gray-50'
              style={{ height: 'calc(100vh - 250px)' }}
            >
              <iframe
                key={previewKey}
                src={buildPreviewUrl()}
                className='w-full h-full'
                title='Email Preview'
                sandbox='allow-same-origin'
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
