import React from 'react';
import { LogoShowcase } from '@/components/logos';

export default function LogosPage() {
  return (
    <div className="min-h-screen bg-background">
      <LogoShowcase />
    </div>
  );
}

export const metadata = {
  title: 'Logo Variations - Wundr Dashboard',
  description: 'Complete logo lockup system with tagline and attribution',
};