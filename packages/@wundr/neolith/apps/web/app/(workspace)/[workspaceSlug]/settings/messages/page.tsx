/**
 * Message Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/messages/page
 */

import { MessageSettings } from '@/components/settings/message-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Message Settings',
  description: 'Configure message and chat preferences',
};

export default function MessagesSettingsPage() {
  return <MessageSettings />;
}
