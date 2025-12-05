/**
 * Audio/Video Settings Page
 * @module app/(workspace)/[workspaceSlug]/settings/audio-video/page
 */

import { AudioVideoSettings } from '@/components/settings/audio-video-settings';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audio & Video Settings',
  description: 'Configure your audio and video devices for meetings and calls',
};

export default function AudioVideoSettingsPage() {
  return <AudioVideoSettings />;
}
